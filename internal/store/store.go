package store

import (
	"encoding/json"
	"os"
	"sync"
	"teleport-ui/internal/models"
)

// DataStore abstracts the file reading and writing logic.
type DataStore struct {
	mu         sync.RWMutex
	dbPath     string
	configPath string
}

func NewDataStore(dbPath, configPath string) *DataStore {
	// Initialize default databases.json if not exist
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		_ = os.WriteFile(dbPath, []byte("[]\n"), 0644)
	}

	// Initialize default config.json if not exist
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		cfg := models.GlobalConfig{TeleportProxy: ""}
		out, _ := json.MarshalIndent(cfg, "", "  ")
		_ = os.WriteFile(configPath, out, 0644)
	}

	return &DataStore{
		dbPath:     dbPath,
		configPath: configPath,
	}
}

func (s *DataStore) GetDatabases() ([]models.Database, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	b, err := os.ReadFile(s.dbPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []models.Database{}, nil
		}
		return nil, err
	}

	var dbs []models.Database
	if err := json.Unmarshal(b, &dbs); err != nil {
		return nil, err
	}
	return dbs, nil
}

func (s *DataStore) SaveDatabase(db models.Database) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, _ := os.ReadFile(s.dbPath)
	var dbs []models.Database
	if len(b) > 0 {
		_ = json.Unmarshal(b, &dbs)
	}

	dbs = append(dbs, db)

	out, err := json.MarshalIndent(dbs, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.dbPath, out, 0644)
}

func (s *DataStore) DeleteDatabase(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, _ := os.ReadFile(s.dbPath)
	var dbs []models.Database
	if len(b) > 0 {
		_ = json.Unmarshal(b, &dbs)
	}

	var updated []models.Database
	for _, db := range dbs {
		if db.ID != id {
			updated = append(updated, db)
		}
	}

	out, err := json.MarshalIndent(updated, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.dbPath, out, 0644)
}

func (s *DataStore) GetConfig() (models.GlobalConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var cfg models.GlobalConfig
	b, err := os.ReadFile(s.configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return models.GlobalConfig{TeleportProxy: ""}, nil
		}
		return cfg, err
	}

	if err := json.Unmarshal(b, &cfg); err != nil {
		return cfg, err
	}

	return cfg, nil
}

func (s *DataStore) SaveConfig(cfg models.GlobalConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	out, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.configPath, out, 0644)
}
