use crate::models::{Database, GlobalConfig};
use serde_json;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DataStore {
    mu: Mutex<()>,
    db_path: PathBuf,
    config_path: PathBuf,
}

impl DataStore {
    pub fn new(db_path: PathBuf, config_path: PathBuf) -> Self {
        // Ensure parent dirs exist
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Some(parent) = config_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        // Initialize databases.json if not exists
        if !db_path.exists() {
            let _ = fs::write(&db_path, b"[]\n");
        }

        // Initialize config.json if not exists
        if !config_path.exists() {
            let cfg = GlobalConfig::default();
            if let Ok(json) = serde_json::to_string_pretty(&cfg) {
                let _ = fs::write(&config_path, json);
            }
        }

        Self {
            mu: Mutex::new(()),
            db_path,
            config_path,
        }
    }

    pub fn get_databases(&self) -> Vec<Database> {
        let _lock = self.mu.lock().unwrap();
        let bytes = fs::read(&self.db_path).unwrap_or_default();
        if bytes.is_empty() {
            return vec![];
        }
        serde_json::from_slice(&bytes).unwrap_or_default()
    }

    pub fn save_database(&self, db: Database) -> Result<(), String> {
        let _lock = self.mu.lock().unwrap();
        let bytes = fs::read(&self.db_path).unwrap_or_default();
        let mut dbs: Vec<Database> = if bytes.is_empty() {
            vec![]
        } else {
            serde_json::from_slice(&bytes).unwrap_or_default()
        };

        // Replace if id exists, else append
        let pos = dbs.iter().position(|d| d.id == db.id);
        if let Some(i) = pos {
            dbs[i] = db;
        } else {
            dbs.push(db);
        }

        let json = serde_json::to_string_pretty(&dbs).map_err(|e| e.to_string())?;
        fs::write(&self.db_path, json).map_err(|e| e.to_string())
    }

    pub fn delete_database(&self, id: &str) -> Result<(), String> {
        let _lock = self.mu.lock().unwrap();
        let bytes = fs::read(&self.db_path).unwrap_or_default();
        let mut dbs: Vec<Database> = if bytes.is_empty() {
            vec![]
        } else {
            serde_json::from_slice(&bytes).unwrap_or_default()
        };

        dbs.retain(|d| d.id != id);

        let json = serde_json::to_string_pretty(&dbs).map_err(|e| e.to_string())?;
        fs::write(&self.db_path, json).map_err(|e| e.to_string())
    }

    pub fn get_config(&self) -> GlobalConfig {
        let _lock = self.mu.lock().unwrap();
        let bytes = fs::read(&self.config_path).unwrap_or_default();
        if bytes.is_empty() {
            return GlobalConfig::default();
        }
        serde_json::from_slice(&bytes).unwrap_or_default()
    }

    pub fn save_config(&self, cfg: GlobalConfig) -> Result<(), String> {
        let _lock = self.mu.lock().unwrap();
        let json = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
        fs::write(&self.config_path, json).map_err(|e| e.to_string())
    }
}
