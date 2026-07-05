import { invoke } from '@tauri-apps/api/core'
import { state } from './state.js'
import { escapeHtml, showToast } from './utils.js'
import { getOrCreateSession } from './terminal.js'
import { showTimerEl, updateTimerDisplay, stopTimer } from './timer.js'
import { openEditModal } from './modals.js'

export async function loadDatabases() {
    try {
        state.databases = await invoke('get_databases')
        renderDatabases()
    } catch (err) {
        console.error('Failed to load databases:', err)
        showToast('Failed to load databases', 'error')
    }
}

function collectGroups() {
    const seen = new Set()
    state.databases.forEach(db => { if (db.group) seen.add(db.group) })
    return [...seen].sort((a, b) => a.localeCompare(b))
}

function renderTabs() {
    const tabsEl = document.getElementById('dbTabs')
    if (!tabsEl) return

    const groups = collectGroups()
    tabsEl.style.display = groups.length > 0 ? '' : 'none'
    tabsEl.innerHTML = ''

    const allTab = document.createElement('button')
    allTab.className = 'db-tab' + (state.activeGroup === '' ? ' active' : '')
    allTab.textContent = 'All'
    allTab.addEventListener('click', () => setActiveGroup(''))
    tabsEl.appendChild(allTab)

    groups.forEach(g => {
        const tab = document.createElement('button')
        tab.className = 'db-tab' + (state.activeGroup === g ? ' active' : '')
        tab.textContent = g
        tab.addEventListener('click', () => setActiveGroup(g))
        tabsEl.appendChild(tab)
    })
}

export function setActiveGroup(group) {
    state.activeGroup = group
    renderTabs()
    renderDBList()
}

function createDBItem(db) {
    const sess = getOrCreateSession(db)

    const item = document.createElement('div')
    item.className = 'db-item' + (state.currentDb?.id === db.id ? ' active' : '')
    item.dataset.dbId = db.id

    const isRunning = sess.isRunning
    item.innerHTML = `
        <div class="db-item-header">
            <h4>${escapeHtml(db.label)}</h4>
            <div class="db-item-actions">
                <div class="status-dot-sm ${isRunning ? 'active' : ''}"></div>
                <button type="button" class="delete-btn" data-id="${db.id}" title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                    </svg>
                </button>
            </div>
        </div>
        <p>${escapeHtml(db.db_name)}</p>
    `

    item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) return
        selectDatabase(db, item)
    })

    item.addEventListener('dblclick', (e) => {
        if (e.target.closest('.delete-btn')) return
        openEditModal(db)
    })

    item.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation()
        deleteDatabase(db.id)
    })

    return item
}

export function renderDatabases() {
    renderTabs()
    renderDBList()
}

function renderDBList() {
    const dbListEl = document.getElementById('dbList')
    if (!dbListEl) return

    dbListEl.innerHTML = ''

    // Filter by active group
    const filtered = state.activeGroup
        ? state.databases.filter(db => db.group === state.activeGroup)
        : state.databases

    if (filtered.length === 0) {
        dbListEl.innerHTML = `
            <div class="db-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
                <p>No databases in this group.</p>
                <p>Click <strong>Add</strong> to create one.</p>
            </div>
        `
        return
    }

    filtered.forEach(db => {
        dbListEl.appendChild(createDBItem(db))
    })
}

export function selectDatabase(db, element) {
    document.querySelectorAll('.db-item').forEach(el => el.classList.remove('active'))
    if (element) element.classList.add('active')

    state.currentDb = db
    
    document.getElementById('welcomeScreen').classList.remove('active')
    document.getElementById('connectScreen').classList.add('active')

    document.getElementById('selectedDbTitle').textContent = db.label
    document.getElementById('selectedDbInstance').textContent = db.db_instance

    const sess = getOrCreateSession(db)

    // Show only this session's terminal
    Object.values(state.sessions).forEach(s => {
        if (s.terminalDiv) s.terminalDiv.style.display = 'none'
    })
    sess.terminalDiv.style.display = 'block'

    // Sync session port from fresh db data (survives edit)
    sess.port = db.port || sess.port || '6666'
    document.getElementById('localPort').value = sess.port
    updateConnectionUI(sess.isRunning)
    updateStatusBadge(sess.isRunning)

    // Show/hide timer for this session
    if (sess.isRunning && sess.timerStart) {
        showTimerEl(true)
        updateTimerDisplay(sess)
    } else {
        showTimerEl(false)
    }
}

export async function deleteDatabase(id) {
    if (!confirm('Delete this database configuration?')) return
    try {
        // Kill active session first
        if (state.sessions[id]?.isRunning) {
            await invoke('stop_proxy', { dbId: id })
        }

        await invoke('delete_database', { id })

        if (state.sessions[id]) {
            if (state.sessions[id].unlisten) state.sessions[id].unlisten()
            stopTimer(state.sessions[id])
            state.sessions[id].terminalDiv.remove()
            delete state.sessions[id]
        }

        if (state.currentDb?.id === id) {
            state.currentDb = null
            document.getElementById('connectScreen').classList.remove('active')
            document.getElementById('welcomeScreen').classList.add('active')
        }

        await loadDatabases()
        showToast('Database deleted', 'success')
    } catch (err) {
        console.error('Delete failed:', err)
        showToast('Failed to delete database', 'error')
    }
}

export function updateConnectionUI(isRunning) {
    const startBtn = document.getElementById('startBtn')
    const stopBtn = document.getElementById('stopBtn')
    if (isRunning) {
        startBtn.classList.add('hidden')
        stopBtn.classList.remove('hidden')
    } else {
        startBtn.classList.remove('hidden')
        stopBtn.classList.add('hidden')
    }
}

export function updateStatusBadge(isRunning) {
    const el = document.getElementById('connectStatus')
    const text = el.querySelector('.status-text')
    if (isRunning) {
        el.classList.add('running')
        text.textContent = 'Running'
    } else {
        el.classList.remove('running')
        text.textContent = 'Idle'
    }
}
