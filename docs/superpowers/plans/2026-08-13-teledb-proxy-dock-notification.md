# TeleDb Proxy macOS Dock Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide macOS Dock icon bouncing ("mantul2") and red badge count notifications whenever a Teleport DB proxy session requests password/OTP re-input, and automatically clear them when resolved or when the window gets focus.

**Architecture:** A Rust Tauri v2 command layer (`set_dock_badge` and `request_user_attention`) bridges native macOS Dock capabilities to a JS notification state manager (`notifications.js`). The JS manager maintains pending authentication requests per `dbId` and coordinates triggers from stdout stream listeners in `proxy.js` and input modal handlers in `terminal.js`.

**Tech Stack:** Tauri v2 (Rust backend), Vite + Vanilla JS (Frontend).

## Global Constraints

- **Platform Target:** macOS (Tauri v2 desktop app)
- **Tauri Version:** Tauri v2 (`@tauri-apps/api^2`, `tauri^2`)
- **Coding Standards:** Follow existing conventions from `CLAUDE.md` (JS ES modules, Rust snake_case commands, direct DOM/state mutations).

---

### Task 1: Add Rust Tauri IPC Commands for Dock Badge & User Attention

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `set_dock_badge(app_handle: tauri::AppHandle, count: Option<i64>) -> Result<(), String>`
- Produces: `request_user_attention(window: tauri::WebviewWindow, critical: bool) -> Result<(), String>`

- [ ] **Step 1: Add Tauri IPC commands in `src-tauri/src/commands.rs`**

Add the following commands to `src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub fn set_dock_badge(app_handle: tauri::AppHandle, count: Option<i64>) -> Result<(), String> {
    app_handle.set_badge_count(count).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn request_user_attention(window: tauri::WebviewWindow, critical: bool) -> Result<(), String> {
    let attention_type = if critical {
        Some(tauri::UserAttentionType::Critical)
    } else {
        None
    };
    window.request_user_attention(attention_type).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: Register commands in `src-tauri/src/lib.rs`**

Update `invoke_handler` in `src-tauri/src/lib.rs` to register `commands::set_dock_badge` and `commands::request_user_attention`:

```rust
        .invoke_handler(tauri::generate_handler![
            commands::get_databases,
            commands::save_database,
            commands::delete_database,
            commands::get_config,
            commands::save_config,
            commands::start_proxy,
            commands::stop_proxy,
            commands::send_input,
            commands::set_dock_badge,
            commands::request_user_attention
        ])
```

- [ ] **Step 3: Check Rust compilation**

Run: `rtk cargo check --manifest-path src-tauri/Cargo.toml`  
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit Task 1**

```bash
rtk git add src-tauri/src/commands.rs src-tauri/src/lib.rs
rtk git commit -m "feat(tauri): add set_dock_badge and request_user_attention IPC commands"
```

---

### Task 2: Create Notification State Manager (`src/modules/notifications.js`)

**Files:**
- Create: `src/modules/notifications.js`

**Interfaces:**
- Consumes: Tauri IPC commands `set_dock_badge` and `request_user_attention`
- Produces: `notifyAuthRequired(dbId: string): Promise<void>`
- Produces: `clearAuthRequired(dbId: string): Promise<void>`
- Produces: `setupNotificationListeners(): void`

- [ ] **Step 1: Create `src/modules/notifications.js`**

Write `src/modules/notifications.js`:

```javascript
import { invoke } from '@tauri-apps/api/core'

const pendingAuthRequests = new Set()

export async function notifyAuthRequired(dbId) {
    if (!dbId) return
    pendingAuthRequests.add(dbId)
    await updateDockNotification(true)
}

export async function clearAuthRequired(dbId) {
    if (!dbId) return
    pendingAuthRequests.delete(dbId)
    await updateDockNotification(false)
}

async function updateDockNotification(bounce = false) {
    const count = pendingAuthRequests.size
    try {
        await invoke('set_dock_badge', { count: count > 0 ? count : null })
        if (bounce && count > 0) {
            await invoke('request_user_attention', { critical: true })
        } else if (count === 0) {
            await invoke('request_user_attention', { critical: false })
        }
    } catch (err) {
        console.error('Failed to update dock notification:', err)
    }
}

export function setupNotificationListeners() {
    window.addEventListener('focus', async () => {
        try {
            await invoke('request_user_attention', { critical: false })
        } catch (err) {
            // Ignore if window focus user attention cancel fails
        }
    })
}
```

- [ ] **Step 2: Verify JS bundling**

Run: `npm run build`  
Expected: PASS with Vite build succeeding.

- [ ] **Step 3: Commit Task 2**

```bash
rtk git add src/modules/notifications.js
rtk git commit -m "feat(frontend): create notification state manager for dock badge and bouncing"
```

---

### Task 3: Wire Notification Triggers in App Lifecycle

**Files:**
- Modify: `src/main.js`
- Modify: `src/modules/proxy.js`
- Modify: `src/modules/terminal.js`

**Interfaces:**
- Consumes: `notifyAuthRequired`, `clearAuthRequired`, `setupNotificationListeners` from `notifications.js`

- [ ] **Step 1: Initialize notification listeners in `src/main.js`**

Import `setupNotificationListeners` in `src/main.js` and call it in `DOMContentLoaded`:

```javascript
import { setupNotificationListeners } from './modules/notifications.js'

// inside DOMContentLoaded init:
setupNotificationListeners()
```

- [ ] **Step 2: Store `dbId` in session and trigger `notifyAuthRequired` / `clearAuthRequired` in `src/modules/terminal.js`**

In `src/modules/terminal.js`:
1. Ensure `getOrCreateSession(db)` sets `sess.dbId = db.id`.
2. Import `clearAuthRequired` from `./notifications.js`.
3. In `showInputModal(title, type, sess)`, update `submitAction` to call `clearAuthRequired(sess.dbId)` after sending input.

```javascript
import { clearAuthRequired } from './notifications.js'

// In getOrCreateSession(db):
state.sessions[db.id] = {
    dbId: db.id,
    isRunning: false,
    ...
}

// In showInputModal submitAction:
if (sess && sess.dbId) {
    clearAuthRequired(sess.dbId)
}
```

- [ ] **Step 3: Wire prompt detection & session disconnect triggers in `src/modules/proxy.js`**

In `src/modules/proxy.js`:
1. Import `notifyAuthRequired` and `clearAuthRequired` from `./notifications.js`.
2. When session closes (`event_type === 'closed'`) or encounters error (`event_type === 'error'`), call `clearAuthRequired(db.id)`.
3. When `password:` or `otp`/`token`/`mfa` prompt is detected:
   - Call `notifyAuthRequired(db.id)`.

```javascript
import { notifyAuthRequired, clearAuthRequired } from './notifications.js'

// Inside proxy-output event listener:
if (event_type === 'closed') {
    ...
    clearAuthRequired(db.id)
    return
}

if (lower.includes('password:') || lower.includes('enter password')) {
    notifyAuthRequired(db.id)
    showInputModal(`🔑 Password for ${db.label}`, 'password', sess)
    sess.streamBuffer = ''
} else if (lower.includes('otp') || lower.includes('token:') || lower.includes('authenticator') || lower.includes('mfa') || lower.includes('security key')) {
    notifyAuthRequired(db.id)
    showInputModal(`📱 OTP for ${db.label}`, 'text', sess)
    sess.streamBuffer = ''
}
```

- [ ] **Step 4: Verify build and test compilation**

Run: `npm run build` and `rtk cargo check --manifest-path src-tauri/Cargo.toml`  
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit Task 3**

```bash
rtk git add src/main.js src/modules/proxy.js src/modules/terminal.js
rtk git commit -m "feat(proxy): wire prompt detection and input modal resolution to dock notifications"
```
