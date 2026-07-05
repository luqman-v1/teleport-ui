import { loadDatabases } from './modules/database.js'
import { setupProxyListeners } from './modules/proxy.js'
import { setupModals, closeModals } from './modules/modals.js'
import { setupTerminalInput, closeTerminalInput } from './modules/terminal.js'
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { showToast } from './modules/utils.js'

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await invoke('tsh_logout')
        showToast('Logged out from Teleport', 'success')
    } catch (err) {
        showToast(`Logout failed: ${err}`, 'error')
    }
})

// Initialize all event listeners
setupProxyListeners()
setupModals()
setupTerminalInput()

// Global Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Try closing terminal input first, then modals
        if (!closeTerminalInput()) {
            closeModals()
        }
    }
})

// Initial Data Load
loadDatabases()

// Set version badge from app metadata
getVersion().then(v => {
    const badge = document.getElementById('versionBadge')
    if (badge) badge.textContent = `v${v} · Luqi`
})
