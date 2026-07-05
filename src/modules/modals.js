import { invoke } from '@tauri-apps/api/core'
import { showToast } from './utils.js'
import { loadDatabases } from './database.js'
import { state } from './state.js'

// Module-level state for add/edit modal
let addModal = null

function closeAddModal() {
    if (!addModal) return
    addModal.classList.remove('active')
    document.getElementById('addDbForm').reset()
    state.editingDbId = null
}

export function openEditModal(db) {
    state.editingDbId = db.id
    document.getElementById('addModalTitle').textContent = 'Edit Database'
    document.getElementById('addModalSaveBtn').textContent = 'Update Database'
    document.getElementById('newLabel').value = db.label || ''
    document.getElementById('newDbName').value = db.db_name || ''
    document.getElementById('newDbInstance').value = db.db_instance || ''
    document.getElementById('newPort').value = db.port || ''
    document.getElementById('newGroup').value = db.group || ''
    addModal.classList.add('active')
}

export function setupModals() {
    addModal = document.getElementById('addDbModal')
    const settingsModal = document.getElementById('settingsModal')

    // Add/Edit DB Modal
    function openAddModal() {
        state.editingDbId = null
        document.getElementById('addModalTitle').textContent = 'Add Database'
        document.getElementById('addModalSaveBtn').textContent = 'Save Database'
        document.getElementById('addDbForm').reset()
        addModal.classList.add('active')
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

        if (state.editingDbId) {
            // Edit mode
            const updatedDb = {
                id: state.editingDbId,
                label: document.getElementById('newLabel').value.trim(),
                db_name: document.getElementById('newDbName').value.trim(),
                db_instance: document.getElementById('newDbInstance').value.trim(),
                port: document.getElementById('newPort').value.trim(),
                group: document.getElementById('newGroup').value.trim(),
            }

            // Stop proxy if running
            if (state.sessions[state.editingDbId]?.isRunning) {
                try {
                    await invoke('stop_proxy', { dbId: state.editingDbId })
                } catch (_) {}
            }

            try {
                await invoke('save_database', { db: updatedDb })
                closeAddModal()
                await loadDatabases()

                // Update connect screen fields if editing currently selected DB
                if (state.currentDb?.id === updatedDb.id) {
                    state.currentDb.label = updatedDb.label
                    state.currentDb.db_name = updatedDb.db_name
                    state.currentDb.db_instance = updatedDb.db_instance
                    state.currentDb.port = updatedDb.port
                    state.currentDb.group = updatedDb.group

                    document.getElementById('selectedDbTitle').textContent = updatedDb.label
                    document.getElementById('selectedDbInstance').textContent = updatedDb.db_instance

                    const sess = state.sessions[updatedDb.id]
                    if (sess) {
                        sess.port = updatedDb.port || '6666'
                        document.getElementById('localPort').value = sess.port
                    }
                }

                showToast(`Updated "${updatedDb.label}"`, 'success')
            } catch (err) {
                console.error('Update DB failed:', err)
                showToast('Failed to update database', 'error')
            }
        } else {
            // Add mode
            const newDb = {
                id: String(Date.now()),
                label: document.getElementById('newLabel').value.trim(),
                db_name: document.getElementById('newDbName').value.trim(),
                db_instance: document.getElementById('newDbInstance').value.trim(),
                port: document.getElementById('newPort').value.trim(),
                group: document.getElementById('newGroup').value.trim(),
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
