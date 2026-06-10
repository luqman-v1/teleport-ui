use crate::models::{ConnectRequest, Database, GlobalConfig, ProxyEvent};
use crate::store::DataStore;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

// ===== STATE for active PTY sessions =====
pub struct PtySessions {
    // db_id -> PTY writer (stdin)
    pub writers: HashMap<String, Box<dyn Write + Send>>,
    // db_id -> kill signal sender
    pub killers: HashMap<String, std::sync::mpsc::SyncSender<()>>,
}

impl PtySessions {
    pub fn new() -> Self {
        Self {
            writers: HashMap::new(),
            killers: HashMap::new(),
        }
    }
}

// ===== DATABASE COMMANDS =====

#[tauri::command]
pub fn get_databases(store: State<'_, Arc<DataStore>>) -> Vec<Database> {
    store.get_databases()
}

#[tauri::command]
pub fn save_database(db: Database, store: State<'_, Arc<DataStore>>) -> Result<(), String> {
    store.save_database(db)
}

#[tauri::command]
pub fn delete_database(id: String, store: State<'_, Arc<DataStore>>) -> Result<(), String> {
    store.delete_database(&id)
}

// ===== CONFIG COMMANDS =====

#[tauri::command]
pub fn get_config(store: State<'_, Arc<DataStore>>) -> GlobalConfig {
    store.get_config()
}

#[tauri::command]
pub fn save_config(config: GlobalConfig, store: State<'_, Arc<DataStore>>) -> Result<(), String> {
    store.save_config(config)
}

// ===== PROXY COMMANDS =====

#[tauri::command]
pub async fn start_proxy(
    request: ConnectRequest,
    app: AppHandle,
    store: State<'_, Arc<DataStore>>,
    sessions: State<'_, Arc<Mutex<PtySessions>>>,
) -> Result<(), String> {
    let db_id = request.db_id.clone();

    // Kill existing session for this db_id if any
    {
        let mut sess = sessions.lock().unwrap();
        if let Some(killer) = sess.killers.remove(&db_id) {
            let _ = killer.try_send(());
        }
        sess.writers.remove(&db_id);
    }

    // Look up DB
    let dbs = store.get_databases();
    let db = dbs
        .into_iter()
        .find(|d| d.id == request.db_id)
        .ok_or_else(|| "Database not found".to_string())?;

    let cfg = store.get_config();

    // Build tsh command
    let db_user = if request.access_type == "write" {
        "telewriter"
    } else {
        "telereader"
    };

    let tsh_db_user = if request.provider == "gcp" {
        format!("{}@your-gcp-project.iam", db_user)
    } else {
        db_user.to_string()
    };

    let port = if request.port.is_empty() {
        "6666".to_string()
    } else {
        request.port.clone()
    };

    let full_cmd = format!(
        "tsh login --proxy='{}' --user='{}' && tsh db login --db-user='{}' --db-name='{}' '{}' && tsh proxy db --db-user='{}' --db-name='{}' --tunnel='{}' --port='{}'",
        cfg.teleport_proxy,
        cfg.teleport_user,
        tsh_db_user,
        db.db_name,
        db.db_instance,
        tsh_db_user,
        db.db_name,
        db.db_instance,
        port,
    );

    let event_name = format!("proxy-output-{}", db_id);
    let event_name_clone = event_name.clone();
    let db_id_clone = db_id.clone();

    // Emit start message
    let _ = app.emit(&event_name, ProxyEvent {
        text: format!("=> Executing: {}\r\n\r\n", full_cmd),
        event_type: "output".to_string(),
    });

    // Kill channel
    let (kill_tx, kill_rx) = std::sync::mpsc::sync_channel::<()>(1);

    // Spawn PTY in separate thread
    let sessions_arc = Arc::clone(&sessions);
    let app_clone = app.clone();

    std::thread::spawn(move || {
        let pty_system = native_pty_system();

        let pair = match pty_system.openpty(PtySize {
            rows: 24,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        }) {
            Ok(p) => p,
            Err(e) => {
                let _ = app_clone.emit(&event_name_clone, ProxyEvent {
                    text: format!("Error opening PTY: {}\r\n", e),
                    event_type: "error".to_string(),
                });
                let _ = app_clone.emit(&event_name_clone, ProxyEvent {
                    text: String::new(),
                    event_type: "closed".to_string(),
                });
                return;
            }
        };

        #[cfg(target_os = "windows")]
        let mut cmd = {
            let mut c = CommandBuilder::new("cmd.exe");
            c.arg("/C");
            c
        };

        #[cfg(not(target_os = "windows"))]
        let mut cmd = {
            let mut c = CommandBuilder::new("sh");
            // GUI apps on macOS/Linux don't inherit the shell's PATH, so we explicitly add common tsh paths
            if let Ok(current_path) = std::env::var("PATH") {
                c.env("PATH", format!("{}:/usr/local/bin:/opt/homebrew/bin", current_path));
            } else {
                c.env("PATH", "/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin");
            }
            c.arg("-c");
            c
        };

        cmd.arg(&full_cmd);

        let _child = match pair.slave.spawn_command(cmd) {
            Ok(c) => c,
            Err(e) => {
                let _ = app_clone.emit(&event_name_clone, ProxyEvent {
                    text: format!("Error spawning command: {}\r\n", e),
                    event_type: "error".to_string(),
                });
                let _ = app_clone.emit(&event_name_clone, ProxyEvent {
                    text: String::new(),
                    event_type: "closed".to_string(),
                });
                return;
            }
        };

        // Store writer for sending input
        let writer = pair.master.take_writer().unwrap();
        {
            let mut sess = sessions_arc.lock().unwrap();
            sess.writers.insert(db_id_clone.clone(), writer);
            sess.killers.insert(db_id_clone.clone(), kill_tx);
        }

        let mut reader = pair.master.try_clone_reader().unwrap();
        let mut buf = [0u8; 1024];

        loop {
            // Check kill signal (non-blocking)
            if kill_rx.try_recv().is_ok() {
                break;
            }

            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let raw = &buf[..n];
                    // Strip ANSI escape codes
                    let text = strip_ansi(raw);
                    let _ = app_clone.emit(&event_name_clone, ProxyEvent {
                        text,
                        event_type: "output".to_string(),
                    });
                }
                Err(_) => break,
            }
        }

        // Cleanup
        {
            let mut sess = sessions_arc.lock().unwrap();
            sess.writers.remove(&db_id_clone);
            sess.killers.remove(&db_id_clone);
        }

        let _ = app_clone.emit(&event_name_clone, ProxyEvent {
            text: String::new(),
            event_type: "closed".to_string(),
        });
    });

    Ok(())
}

#[tauri::command]
pub fn stop_proxy(
    db_id: String,
    sessions: State<'_, Arc<Mutex<PtySessions>>>,
) -> Result<(), String> {
    let mut sess = sessions.lock().unwrap();
    if let Some(killer) = sess.killers.remove(&db_id) {
        let _ = killer.try_send(());
    }
    sess.writers.remove(&db_id);
    Ok(())
}

#[tauri::command]
pub fn send_input(
    db_id: String,
    input: String,
    sessions: State<'_, Arc<Mutex<PtySessions>>>,
) -> Result<(), String> {
    let mut sess = sessions.lock().unwrap();
    if let Some(writer) = sess.writers.get_mut(&db_id) {
        writer
            .write_all(input.as_bytes())
            .map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ===== ANSI STRIP HELPER =====
fn strip_ansi(bytes: &[u8]) -> String {
    let s = String::from_utf8_lossy(bytes).to_string();
    // Remove ESC sequences
    let re_simple = regex_simple(&s);
    re_simple
}

fn regex_simple(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            match chars.peek() {
                Some('[') => {
                    chars.next();
                    // consume until final byte (letter)
                    loop {
                        match chars.next() {
                            Some(ch) if ch.is_ascii_alphabetic() => break,
                            None => break,
                            _ => {}
                        }
                    }
                }
                Some(']') => {
                    chars.next();
                    // consume until ST (ESC \) or BEL
                    loop {
                        match chars.next() {
                            Some('\x07') => break,
                            Some('\x1b') => { chars.next(); break; }
                            None => break,
                            _ => {}
                        }
                    }
                }
                _ => { chars.next(); }
            }
        } else {
            out.push(c);
        }
    }
    out
}
