# TeleDB Proxy

A desktop application for connecting to databases via [Teleport](https://goteleport.com/) without dealing with command-line flags. Built with **Tauri v2** (Rust backend + Vite frontend).

![TeleDB Proxy Screenshot](ss.png)

## Features

- **Database Management** — Add, edit, and delete database configurations
- **One-Click Proxy** — Launch `tsh proxy db` sessions with a single click
- **Interactive Terminal** — View live output with automatic password/OTP prompts
- **Multiple Sessions** — Run multiple proxy sessions simultaneously
- **Global Settings** — Configure Teleport proxy host and username once

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Node.js](https://nodejs.org/) (v18+)
- Teleport CLI (`tsh`) installed and in PATH

## Development

```bash
# Install Node dependencies
npm install

# Run the Tauri app in development mode
npm run tauri dev
```

## Build

```bash
# Build the application bundle for your platform
npm run tauri build
```

The compiled binary will be in `src-tauri/target/release/bundle/`.

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Rust + Tauri v2 | State management, PTY process execution, file I/O |
| **Frontend** | Vite + Vanilla JS/CSS | UI with glassmorphic design system |
| **PTY** | `portable-pty` | Interactive `tsh` sessions with password/OTP support |
| **Storage** | JSON files | Database configs & global settings in app data dir |

## Project Structure

```
teleport-ui/
├── index.html              # Vite entry point
├── src/
│   ├── main.js             # Frontend logic
│   ├── style.css           # Design system & styles
│   └── favicon.svg         # App icon
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         # Tauri entry point
│   │   ├── lib.rs          # App setup & plugin registration
│   │   ├── commands.rs     # Tauri IPC commands
│   │   ├── models.rs       # Data structures
│   │   └── store.rs        # JSON file persistence
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── vite.config.js          # Vite configuration
└── package.json            # Node dependencies
```

## License

Open sourced for [Stockbit](https://stockbit.com).
