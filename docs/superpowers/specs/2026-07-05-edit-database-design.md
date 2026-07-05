# Edit Database Feature

## Summary
Double-click DB in sidebar to edit label, db_name, db_instance, port. Reuses Add modal with dynamic title + pre-filled form. Auto-disconnect proxy if running.

## Changes

### index.html
- Add `id="addModalTitle"` on modal `<h2>` for dynamic text
- Change `id="addDbForm"` submit button to `id="addModalSaveBtn"` — text dynamic "Save" vs "Update"

### src/modules/state.js
- Add `editingDbId: null` — tracks edit mode. `null` = adding new, string = editing that DB id.

### src/modules/database.js
- Add double-click listener on `.db-item` → call `openEditModal(db)`
- Track `editingDbId` in state

### src/modules/modals.js
- Extract `openEditModal(db)` and `openAddModal()` functions
- `openEditModal`:
  1. Set `state.editingDbId = db.id`
  2. Change modal title to "Edit Database"
  3. Pre-fill all fields from `db`
  4. Show modal
- `closeAddModal`: also reset `state.editingDbId = null`
- Submit handler:
  - If `state.editingDbId`: run edit flow (stop proxy if running → save with same ID)
  - Else: existing add flow

### Data Flow
1. Double-click DB → edit modal → fields pre-filled
2. User edits → submit → if proxy running, stop it → save with same DB id → reload list → toast "Updated"
3. If cancel/modal close → `editingDbId = null`

## Backward Compat
No changes to Rust backend. `save_database` already upserts by id.
