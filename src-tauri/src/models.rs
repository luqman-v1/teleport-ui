use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Database {
    pub id: String,
    pub label: String,
    pub db_name: String,
    pub db_instance: String,
    #[serde(default)]
    pub port: String,
    #[serde(default)]
    pub group: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalConfig {
    pub teleport_proxy: String,
    pub teleport_user: String,
}

impl Default for GlobalConfig {
    fn default() -> Self {
        Self {
            teleport_proxy: String::new(),
            teleport_user: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub db_id: String,
    pub access_type: String,
    pub provider: String,
    pub port: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyEvent {
    pub text: String,
    pub event_type: String, // "output" | "error" | "closed"
}
