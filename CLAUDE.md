# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm install              # Install frontend deps
make dev                 # Run Tauri dev mode (sources ~/.cargo/env)
make build               # Build production bundle
make clean               # Remove target/, node_modules/, dist/
npm run dev              # Standalone Vite dev server (no Tauri backend)
npm run build            # Vite build only
npm run tauri <cmd>      # Passthrough to Tauri CLI
```

No test runner, linter, or formatter configured — project is pre-v1 polish.

## Architecture Overview

**Tauri v2 desktop app** — GUI for launching `tsh proxy db` sessions against Teleport databases. Single-window, dark-theme, glassmorphic UI. Vanilla JS frontend (no framework). Rust backend with PTY process management.

### Frontend (Vite + Vanilla JS)

`src/` — ES modules, single entry `main.js`:

| Module | Responsibility |
|--------|---------------|
| `main.js` | Bootstrap, init listeners, initial data load |
| `state.js` | Mutable global state object (`databases[]`, `currentDb`, `sessions{}`) |
| `database.js` | CRUD for DB configs, render DB list, selection handling |
| `proxy.js` | Proxy session start/stop, Tauri IPC listener setup per session |
| `terminal.js` | Terminal output rendering, input overlay for password/OTP |
| `modals.js` | Add DB modal, Settings modal (teleport proxy & user config) |
| `timer.js` | Elapsed-time display for active proxy sessions |
| `utils.js` | `escapeHtml()`, `showToast()` |

No component system, no virtual DOM — direct `getElementById` / `innerHTML` / `classList` patterns. Single `style.css` (~1k lines) with CSS custom properties, glassmorphism, animated gradient background. No Tailwind/PostCSS.

### Backend (Rust + Tauri v2)

`src-tauri/src/`:

| File | Responsibility |
|------|---------------|
| `main.rs` | Windows subsystem attr → calls `lib::run()` |
| `lib.rs` | Tauri builder setup, plugin registration, app state init |
| `commands.rs` | All 8 Tauri commands + PTY session spawn/read/kill logic |
| `models.rs` | `Database`, `GlobalConfig`, `ConnectRequest`, `ProxyEvent` structs |
| `store.rs` | `DataStore` — JSON file I/O with `Mutex<()>` locking |

### IPC: Tauri Commands

| Command | JS → Rust | Purpose |
|---------|-----------|---------|
| `get_databases` | invoke | Load DB list from JSON |
| `save_database` | invoke | Add/update DB |
| `delete_database` | invoke | Delete DB (stops its proxy) |
| `get_config` / `save_config` | invoke | Teleport proxy/user config |
| `start_proxy` | invoke | Spawn PTY for `tsh proxy db` |
| `stop_proxy` | invoke | Kill active PTY session |
| `send_input` | invoke | Write to PTY stdin |

### IPC: Events (Rust → JS)

`proxy-output-{db_id}` — streamed per-session. Payload: `{ text: string, event_type: "output" | "error" | "closed" }`. Frontend listens per db_id, scans stream for password/OTP prompts → shows input overlay → calls `send_input`.

### PTY Lifecycle

1. `start_proxy` receives `ConnectRequest` (db_id, access_type, provider, port)
2. Rust builds `tsh login && tsh db login && tsh proxy db` command
3. Rust spawns OS thread → opens native PTY (`portable-pty`) → spawns `sh -c "<cmd>"`
4. Read loop: PTY stdout → ANSI strip (custom state-machine) → emit `proxy-output-{id}` events
5. PTY close or `stop_proxy` sends event_type: "closed"
6. JS cleans up session state

Sessions stored in `Arc<Mutex<HashMap<String, Writer>>>`. Kill signal via `mpsc::sync_channel` (non-blocking `.try_recv()`).

### Data Persistence

Two JSON files in Tauri app data dir:
- `databases.json` — array of `Database` objects
- `config.json` — `{ teleport_proxy: string, teleport_user: string }`

`DataStore` uses `Mutex<()>` for serialized read/write access.

## CI/CD

`.github/workflows/release.yml` — build + publish via `tauri-apps/tauri-action` on tag `v*` or manual dispatch. Matrix: macos/ubuntu/windows.

## Key Conventions

- **Rust**: snake_case functions/vars, PascalCase types, `Result<(), String>` return pattern for all commands
- **JS**: camelCase, ES modules, descriptive handler names (`setupProxyListeners`, `startProxySession`)
- **CSS**: kebab-case classes, BEM-ish (`.btn-primary`, `.btn-glow`, `.terminal-line-error`)
- **Files**: kebab-case
- **DB IDs**: frontend generates via `String(Date.now())`
- **State**: mutable module-level object, manual DOM re-render on change

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->