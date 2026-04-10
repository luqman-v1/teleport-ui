package server

import (
	"encoding/json"
	"net/http"
	"teleport-ui/internal/models"
	"teleport-ui/internal/store"
	"teleport-ui/web"

	"golang.org/x/net/websocket"
)

// Server manages HTTP dependencies and routing.
type Server struct {
	store *store.DataStore
}

func NewServer(s *store.DataStore) *Server {
	return &Server{store: s}
}

func (srv *Server) RegisterRoutes(mux *http.ServeMux) {
	fileServer := http.FileServer(http.FS(web.Assets))

	// Serve sw.js at root scope with required Service-Worker-Allowed header
	mux.HandleFunc("/sw.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		w.Header().Set("Service-Worker-Allowed", "/")
		w.Header().Set("Cache-Control", "no-cache")
		fileServer.ServeHTTP(w, r)
	})

	// Serve manifest.json with correct MIME type for PWA
	mux.HandleFunc("/manifest.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/manifest+json")
		fileServer.ServeHTTP(w, r)
	})

	// Serve PWA icons
	mux.Handle("/icons/", fileServer)

	mux.Handle("/", fileServer)
	mux.HandleFunc("/api/databases", srv.handleDatabases)
	mux.HandleFunc("/api/config", srv.handleConfig)
	mux.Handle("/api/connect", websocket.Handler(srv.handleConnectWS))
}

func (srv *Server) handleDatabases(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		dbs, err := srv.store.GetDatabases()
		if err != nil {
			http.Error(w, "Failed to read databases", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(dbs)

	case http.MethodPost:
		var newDb models.Database
		if err := json.NewDecoder(r.Body).Decode(&newDb); err != nil {
			http.Error(w, "Invalid payload", http.StatusBadRequest)
			return
		}

		if err := srv.store.SaveDatabase(newDb); err != nil {
			http.Error(w, "Failed to save database", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"success"}`))

	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "ID required", http.StatusBadRequest)
			return
		}
		if err := srv.store.DeleteDatabase(id); err != nil {
			http.Error(w, "Failed to delete database", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"success"}`))

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (srv *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg, err := srv.store.GetConfig()
		if err != nil {
			http.Error(w, "Failed to read config", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cfg)

	case http.MethodPost:
		var newCfg models.GlobalConfig
		if err := json.NewDecoder(r.Body).Decode(&newCfg); err != nil {
			http.Error(w, "Invalid payload", http.StatusBadRequest)
			return
		}

		if err := srv.store.SaveConfig(newCfg); err != nil {
			http.Error(w, "Failed to save config", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"success"}`))

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
