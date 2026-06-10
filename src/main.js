import { loadDatabases } from './modules/database.js'
import { setupProxyListeners } from './modules/proxy.js'
import { setupModals, closeModals } from './modules/modals.js'
import { setupTerminalInput, closeTerminalInput } from './modules/terminal.js'

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
