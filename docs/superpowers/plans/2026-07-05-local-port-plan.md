# Per-DB Local Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save local port per-database so port persists across sessions instead of resetting to 6666.

**Architecture:** Add `port` field to Database struct (Rust) with serde default for backward compat. Frontend saves port on successful proxy connect. Existing DBs without port field fall back to "6666".

**Tech Stack:** Rust (Tauri), Vanilla JS

## Global Constraints

- `#[serde(default)]` on new `port` field so old `databases.json` entries don't break
- Empty port string → fallback to "6666" everywhere
- No migration script — serde default handles it
- Port auto-saved on successful proxy connect, no separate save button

---

### Task 1: Backend — Add `port` field to Database model

**Files:**
- Modify: `src-tauri/src/models.rs`

**Interfaces:**
- Produces: `Database` struct with optional `port: String` field

- [ ] **Add port field with serde default**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Database {
    pub id: String,
    pub label: String,
    pub db_name: String,
    pub db_instance: String,
    #[serde(default)]
    pub port: String,
}
```

- [ ] **Commit**

```bash
cd /Users/luqmannulhakim/gomod/project/teleport-ui
git add src-tauri/src/models.rs
git commit -m "feat: add port field to Database model with serde default"
```

---

### Task 2: Frontend — Render port in Add DB modal

**Files:**
- Modify: `index.html`
- Modify: `src/modules/modals.js`

- [ ] **Add port input to Add DB HTML form** (after db_instance, before modal actions)

In `index.html`, inside `#addDbForm`:

```html
<div class="form-group">
    <label for="newPort">Local Port <span class="optional">(optional)</span></label>
    <input type="number" id="newPort" placeholder="Default: 6666" min="1024" max="65535">
</div>
```

- [ ] **Save port in form submit handler**

In `src/modules/modals.js`, inside the `addDbForm` submit handler, add `port` to `newDb` object:

```js
const newDb = {
    id: String(Date.now()),
    label: document.getElementById('newLabel').value.trim(),
    db_name: document.getElementById('newDbName').value.trim(),
    db_instance: document.getElementById('newDbInstance').value.trim(),
    port: document.getElementById('newPort').value.trim(),
}
```

- [ ] **Commit**

```bash
cd /Users/luqmannulhakim/gomod/project/teleport-ui
git add index.html src/modules/modals.js
git commit -m "feat: add port input to Add DB modal"
```

---

### Task 3: Frontend — Use port from DB config in session and connect form

**Files:**
- Modify: `src/modules/terminal.js`
- Modify: `src/modules/database.js`

- [ ] **Replace hardcoded "6666" with DB port fallback**

In `src/modules/terminal.js`, `getOrCreateSession`:

```js
state.sessions[db.id] = {
    isRunning: false,
    terminalDiv: tDiv,
    port: db.port || '6666',
    unlisten: null,
    timerStart: null,
    timerInterval: null,
    streamBuffer: ''
}
```

- [ ] **Commit**

```bash
cd /Users/luqmannulhakim/gomod/project/teleport-ui
git add src/modules/terminal.js
git commit -m "fix: use db.port instead of hardcoded 6666 in session"
```

---

### Task 4: Frontend — Save port on successful proxy connect

**Files:**
- Modify: `src/modules/proxy.js`

- [ ] **Save port to database after proxy start succeeds**

In `src/modules/proxy.js`, `startProxySession` function, inside the try block after `invoke('start_proxy', ...)` succeeds:

```js
// Save port for persistence
db.port = port
try {
    await invoke('save_database', { db })
} catch (saveErr) {
    console.error('Failed to save port:', saveErr)
    // Non-blocking — proxy already running
}
```

- [ ] **Commit**

```bash
cd /Users/luqmannulhakim/gomod/project/teleport-ui
git add src/modules/proxy.js
git commit -m "feat: auto-save port to database on proxy connect"
```

---

### Task 5: Build & verify

- [ ] **Build to confirm no compilation errors**

```bash
cd /Users/luqmannulhakim/gomod/project/teleport-ui
make build
```

Expected: Build succeeds with no errors.

- [ ] **Final commit with all changes**

```bash
cd /Users/luqmannulhakim/gomod/project/teleport-ui
git add -A
git commit -m "feat: per-DB local port persistence"
```
