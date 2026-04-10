package store

import (
	"os"
	"testing"
	"teleport-ui/internal/models"
)

func TestDataStore(t *testing.T) {
	// Create temp files to ensure tests don't affect live data
	dbFile, err := os.CreateTemp("", "dbs-*.json")
	if err != nil {
		t.Fatalf("failed to create temp db file: %v", err)
	}
	defer os.Remove(dbFile.Name())

	cfgFile, err := os.CreateTemp("", "cfg-*.json")
	if err != nil {
		t.Fatalf("failed to create temp cfg file: %v", err)
	}
	defer os.Remove(cfgFile.Name())

	store := NewDataStore(dbFile.Name(), cfgFile.Name())

	// Test 1: Config Save and Retrieve
	cfg := models.GlobalConfig{ TeleportProxy: "test.com", TeleportUser: "user@test.com" }
	err = store.SaveConfig(cfg)
	if err != nil {
		t.Errorf("expected no error saving config, got %v", err)
	}

	readCfg, err := store.GetConfig()
	if err != nil {
		t.Errorf("expected no error getting config, got %v", err)
	}
	if readCfg.TeleportProxy != "test.com" {
		t.Errorf("expected proxy 'test.com', got '%s'", readCfg.TeleportProxy)
	}

	// Test 2: Database Save and Retrieve
	db1 := models.Database{ ID: "test-id-1", Label: "DB1", DbName: "db1", DbInstance: "inst1" }
	err = store.SaveDatabase(db1)
	if err != nil {
		t.Errorf("expected no error saving DB, got %v", err)
	}

	dbs, err := store.GetDatabases()
	if err != nil {
		t.Errorf("expected no error getting DBs, got %v", err)
	}
	if len(dbs) != 1 {
		t.Errorf("expected 1 DB, got %v", len(dbs))
	}

	// Test 3: Delete Database
	err = store.DeleteDatabase("test-id-1")
	if err != nil {
		t.Errorf("expected no error deleting DB, got %v", err)
	}

	dbs, _ = store.GetDatabases()
	if len(dbs) != 0 {
		t.Errorf("expected 0 DB after delete, got %v", len(dbs))
	}
}
