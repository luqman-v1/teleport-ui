# Teleport DB Proxy UI

Teleport DB Proxy UI is a modern, lightweight web-based interface for managing Teleport database connections. Built entirely in Go, it eliminates the need to run repetitive `tsh` proxy terminal commands and simplifies multi-database access into an elegant centralized hub.

Made with ❤️ by **Luqi** • Open Sourced for **Stockbit**

---

## 🌟 Pros / Capabilities
* **Multi-session Proxying**: Keep multiple background database connections alive concurrently across different local ports without opening dozen terminal tabs.
* **Interactive Terminal Capture (PTY)**: Dynamically inject SSO passwords and OTP (2FA) inputs directly through beautiful UI modals rather than typing in the console.
* **Dynamic Configuration Data**: Your databases layout and application configurations are automatically persisted securely into local JSON files.
* **Native Cross-Platform**: Compile the tool into highly portable binary executables for macOS, Linux, and Windows Native via the Makefile.

## 🛑 Cons / Limitations
* **Terminal Dependent Output**: Due to capturing stdout via PTY, it does not currently launch external browser hooks natively for SAML auth directly inside the Teleport CLI flow—it heavily depends on intercepts of pure terminal user/password prompts.
* **Tethered Processes**: When the primary Teleport UI web-server daemon is killed/stopped in the terminal, all tunneled background connections die permanently with it. There's no detached background-service handling capability quite yet.

---

## 📋 Prerequisites
Before you begin, ensure you have the following installed on your machine:
1. **[Go 1.26+](https://go.dev/doc/install)** (For compiling or running the tool locally).
2. **[Teleport CLI (`tsh`)](https://goteleport.com/download/)** configured and working previously to interface with your cluster infrastructure.

---

## 🚀 Getting Started

### 1. Run The App
Clone this repository and easily handle everything using `make`.

To run the application immediately in local-development mode:
```bash
make run
```
*Note: A tab in your default Web Browser will be auto-generated for you as soon as the web server binds!*

To build static, cross-platform executable binaries directly into the `bin/` directory:
```bash
make build-all
```

### 2. Define Configurations
Once the application interface is visible on your browser (default runs at `http://localhost:8080`), set up your Teleport CLI mapping:
1. Click the **⚙️ Global Settings** button in the lower left navigation pane.
2. Enter your `Teleport Proxy Host` (e.g., `teleport.host.com:443`) and your `Teleport Username` (e.g., `name@mail.com`).
3. Click **Save Settings**.

### 3. Register Databases
1. Click **+ Add New** to mount a new connection.
2. Provide a friendly visual label, the registered internal database name, and the cluster's Teleport Instance routing mapping.

### 4. Initiate Tunneled Connection
Select any registered database on your sidebar, specify an unused local port logic mapping (e.g. `6666`), and deploy! You will be securely prompted for your SSO password and OTP tokens straight from the UI popup. Keep the session logs spinning in the background.

---

## 👨‍💻 Contributing
Feel free to open issues or send pull-requests as this is an evolving experiment to drastically simplify internal DevOps database procedures!

**License**: MIT 
