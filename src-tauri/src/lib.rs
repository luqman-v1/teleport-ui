mod commands;
mod models;
mod store;

use commands::PtySessions;
use std::sync::{Arc, Mutex};
use store::DataStore;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Resolve app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");

            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");

            let db_path = app_data_dir.join("databases.json");
            let config_path = app_data_dir.join("config.json");

            // Initialize DataStore and register as managed state
            let store = Arc::new(DataStore::new(db_path, config_path));
            app.manage(store);

            // Initialize PTY session registry
            let sessions = Arc::new(Mutex::new(PtySessions::new()));
            app.manage(sessions);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_databases,
            commands::save_database,
            commands::delete_database,
            commands::get_config,
            commands::save_config,
            commands::start_proxy,
            commands::stop_proxy,
            commands::send_input,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
