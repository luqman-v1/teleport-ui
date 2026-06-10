import { invoke } from '@tauri-apps/api/core'
import { showToast } from './utils.js'
import { loadDatabases } from './database.js'

export function setupModals() {
    const addModal = document.getElementById('addDbModal')
    const settingsModal = document.getElementById('settingsModal')

    // Add DB Modal
    function openAddModal() { addModal.classList.add('active') }
    function closeAddModal() {
        addModal.classList.remove('active')
        document.getElementById('addDbForm').reset()
    }

    document.getElementById('addDbBtn').addEventListener('click', openAddModal)
    document.getElementById('welcomeAddBtn').addEventListener('click', openAddModal)
    document.getElementById('closeModalBtn').addEventListener('click', closeAddModal)
    document.getElementById('closeModalBtn2').addEventListener('click', closeAddModal)

    addModal.addEventListener('click', (e) => {
        if (e.target === addModal) closeAddModal()
    })

    document.getElementById('addDbForm').addEventListener('submit', async (e) => {
        e.preventDefault()
        const newDb = {
            id: String(Date.now()),
            label: document.getElementById('newLabel').value.trim(),
            db_name: document.getElementById('newDbName').value.trim(),
            db_instance: document.getElementById('newDbInstance').value.trim(),
        }

        try {
            await invoke('save_database', { db: newDb })
            closeAddModal()
            await loadDatabases()
            showToast(`Added "${newDb.label}"`, 'success')
        } catch (err) {
            console.error('Save DB failed:', err)
            showToast('Failed to save database', 'error')
        }
    })

    // Settings Modal
    async function openSettings() {
        try {
            const cfg = await invoke('get_config')
            document.getElementById('teleportProxy').value = cfg.teleport_proxy || ''
            document.getElementById('teleportUser').value = cfg.teleport_user || ''
            settingsModal.classList.add('active')
        } catch (err) {
            console.error('Load config failed:', err)
            showToast('Failed to load settings', 'error')
        }
    }

    function closeSettings() { settingsModal.classList.remove('active') }

    document.getElementById('settingsBtn').addEventListener('click', openSettings)
    document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings)
    document.getElementById('closeSettingsBtn2').addEventListener('click', closeSettings)

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings()
    })

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault()
        const cfg = {
            teleport_proxy: document.getElementById('teleportProxy').value.trim(),
            teleport_user: document.getElementById('teleportUser').value.trim(),
        }
        try {
            await invoke('save_config', { config: cfg })
            closeSettings()
            showToast('Settings saved', 'success')
        } catch (err) {
            console.error('Save config failed:', err)
            showToast('Failed to save settings', 'error')
        }
    })
}

export function closeModals() {
    const addModal = document.getElementById('addDbModal')
    const settingsModal = document.getElementById('settingsModal')
    
    let closed = false
    if (addModal && addModal.classList.contains('active')) {
        addModal.classList.remove('active')
        closed = true
    }
    if (settingsModal && settingsModal.classList.contains('active')) {
        settingsModal.classList.remove('active')
        closed = true
    }
    return closed
}
