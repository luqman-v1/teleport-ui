package models

type Database struct {
	ID         string `json:"id"`
	Label      string `json:"label"`
	DbName     string `json:"db_name"`
	DbInstance string `json:"db_instance"`
}

type GlobalConfig struct {
	TeleportProxy string `json:"teleport_proxy"`
	TeleportUser  string `json:"teleport_user"`
}

type ConnectRequest struct {
	AccessType string `json:"access_type"`
	Provider   string `json:"provider"`
	DbID       string `json:"db_id"`
	Port       string `json:"port"`
}
