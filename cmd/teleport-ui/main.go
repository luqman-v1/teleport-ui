package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"teleport-ui/internal/server"
	"teleport-ui/internal/store"
)

func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}
	if err != nil {
		log.Printf("Failed to open browser automatically: %v\n", err)
	}
}

func main() {
	portFlag := flag.String("port", "8080", "Port to run the web server on")
	flag.Parse()

	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("Could not find user home directory: %v", err)
	}

	appDir := filepath.Join(homeDir, ".teleport-ui")
	dbPath := filepath.Join(appDir, "databases.json")
	configPath := filepath.Join(appDir, "config.json")

	// Migration logic: copy existing files from current working directory if available
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		if b, err := os.ReadFile("databases.json"); err == nil {
			os.MkdirAll(appDir, 0755)
			os.WriteFile(dbPath, b, 0644)
		}
	}
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		if b, err := os.ReadFile("config.json"); err == nil {
			os.MkdirAll(appDir, 0755)
			os.WriteFile(configPath, b, 0644)
		}
	}

	// Initialize the file-based persistent store
	s := store.NewDataStore(dbPath, configPath)
	
	// Inject the store into the HTTP Server
	srv := server.NewServer(s)

	// Set up routing
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	port := ":" + *portFlag
	url := "http://localhost" + port

	fmt.Println("=> Teleport UI Web Server started.")
	fmt.Printf("=> PLEASE OPEN YOUR BROWSER AT: %s\n\n", url)

	// Attempt to open default browser automatically
	go openBrowser(url)

	log.Fatal(http.ListenAndServe(port, mux))
}
