# Per-DB Local Port Persistence

## Summary
Save local port per-database so it persists across sessions instead of resetting to 6666.

## Changes

### Rust: `src-tauri/src/models.rs`
Add `port` field to `Database` struct with `#[serde(default)]` for backward compat.

```rust
pub struct Database {
    pub id: String,
    pub label: String,
    pub db_name: String,
    pub db_instance: String,
    #[serde(default)]
    pub port: String,   // empty = use 6666 fallback
}
```

### Frontend: `src/modules/terminal.js`
Replace hardcoded `port: '6666'` in `getOrCreateSession`:
```js
port: db.port || '6666',
```

### Frontend: `src/modules/modals.js`
Add port field to Add DB form (after db_instance). Optional — empty means 6666 fallback.
Save `newDb.port` from `document.getElementById('newPort').value`.

### Frontend: `src/modules/proxy.js`
After proxy start succeeds, save port to database:
```js
db.port = port
await invoke('save_database', { db })
```
Show toast error if save fails (but proxy still works).

### Frontend: `index.html`
No structural changes. Add port input field inside Add DB modal form.

## Data Flow
1. Create DB → port saved to `databases.json`
2. Select DB → `localPort` input filled from `db.port || '6666'`
3. User can edit port before connecting
4. Connect → port saved back to DB on success
5. Reopen app → port persists in `databases.json`

## Backward Compatibility
Old `databases.json` entries (no `port` field) → `#[serde(default)]` → empty string → `'6666'` fallback.
