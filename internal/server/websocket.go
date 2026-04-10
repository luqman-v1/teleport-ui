package server

import (
	"fmt"
	"io"
	"os/exec"
	"strings"
	"teleport-ui/internal/models"

	"github.com/creack/pty"
	"golang.org/x/net/websocket"
)

func (srv *Server) handleConnectWS(ws *websocket.Conn) {
	var req models.ConnectRequest
	if err := websocket.JSON.Receive(ws, &req); err != nil {
		ws.Write([]byte(fmt.Sprintf("Error reading payload: %v\r\n", err)))
		return
	}

	dbs, _ := srv.store.GetDatabases()
	cfg, _ := srv.store.GetConfig()

	var selectedDB models.Database
	for _, db := range dbs {
		if fmt.Sprintf("%v", db.ID) == fmt.Sprintf("%v", req.DbID) {
			selectedDB = db
			break
		}
	}

	if selectedDB.DbName == "" {
		ws.Write([]byte("Database not found\r\n"))
		ws.Close()
		return
	}

	dbUser := "telereader"
	if req.AccessType == "write" {
		dbUser = "telewriter"
	}

	tshDbUser := dbUser
	if req.Provider == "gcp" {
		tshDbUser = dbUser + "@your-gcp-project.iam"
	}

	port := req.Port
	if port == "" {
		port = "6666" // default fallback
	}

	cmdLogin := fmt.Sprintf("tsh login --proxy='%s' --user='%s'", cfg.TeleportProxy, cfg.TeleportUser)
	cmdDbLogin := fmt.Sprintf("tsh db login --db-user='%s' --db-name='%s' '%s'", tshDbUser, selectedDB.DbName, selectedDB.DbInstance)
	cmdProxy := fmt.Sprintf("tsh proxy db --db-user='%s' --db-name='%s' --tunnel='%s' --port='%s'", tshDbUser, selectedDB.DbName, selectedDB.DbInstance, port)

	fullCmd := fmt.Sprintf("%s && %s && %s", cmdLogin, cmdDbLogin, cmdProxy)
	ws.Write([]byte(fmt.Sprintf("=> Executing: %s\r\n\r\n", fullCmd)))

	c := exec.Command("sh", "-c", fullCmd)
	ptmx, err := pty.Start(c)
	if err != nil {
		ws.Write([]byte(fmt.Sprintf("Error starting pty: %v\r\n", err)))
		return
	}

	defer func() {
		_ = ptmx.Close()
		_ = c.Process.Kill()
		_ = c.Wait() 
	}()

	// Read from PTY -> WebSocket
	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := ptmx.Read(buf)
			if err != nil {
				if err != io.EOF && !strings.Contains(err.Error(), "input/output error") {
					ws.Write([]byte(fmt.Sprintf("\r\n[Process Error: %v]\r\n", err)))
				} else {
					ws.Write([]byte("\r\n[Process Completed & Closed]\r\n"))
				}
				ws.Close()
				break
			}
			ws.Write(buf[:n])
		}
	}()

	// Read from WebSocket -> PTY
	buf := make([]byte, 1024)
	for {
		n, err := ws.Read(buf)
		if err != nil {
			break // Connection closed by client
		}
		_, _ = ptmx.Write(buf[:n])
	}
}
