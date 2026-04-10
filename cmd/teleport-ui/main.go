package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os/exec"
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

	// Initialize the file-based persistent store
	s := store.NewDataStore("databases.json", "config.json")
	
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
