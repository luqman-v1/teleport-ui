import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { state } from './state.js'
import { escapeHtml, showToast } from './utils.js'
import { getOrCreateSession, appendTerminal, showInputModal } from './terminal.js'
import { startTimer, stopTimer } from './timer.js'
import { renderDatabases, updateConnectionUI, updateStatusBadge } from './database.js'

export function setupProxyListeners() {
    document.getElementById('connectForm').addEventListener('submit', async (e) => {
        e.preventDefault()
        if (!state.currentDb) return

        const accessType = document.getElementById('accessType').value
        const provider = document.getElementById('provider').value
        const port = document.getElementById('localPort').value

        await startProxySession(state.currentDb, accessType, provider, port)
    })

    document.getElementById('stopBtn').addEventListener('click', async () => {
        if (!state.currentDb) return
        try {
            await invoke('stop_proxy', { dbId: state.currentDb.id })
            showToast(`Disconnected from ${state.currentDb.label}`, 'info')
        } catch (err) {
            console.error('Stop failed:', err)
            showToast('Failed to stop proxy', 'error')
        }
    })
}

async function startProxySession(db, accessType, provider, port) {
    const sess = getOrCreateSession(db)
    sess.port = port
    sess.isRunning = true
    sess.streamBuffer = ''

    updateConnectionUI(true)
    updateStatusBadge(true)
    renderDatabases()
    startTimer(sess)

    sess.terminalDiv.innerHTML = `<span class="terminal-line-info">=> Connecting ${escapeHtml(db.label)} on port ${port}...\n</span>`

    // Cleanup previous listener
    if (sess.unlisten) {
        sess.unlisten()
        sess.unlisten = null
    }

    // Listen for output events from Rust backend
    sess.unlisten = await listen(`proxy-output-${db.id}`, (event) => {
        const { text, event_type } = event.payload

        if (event_type === 'closed') {
            sess.isRunning = false
            stopTimer(sess)
            updateConnectionUI(false)
            updateStatusBadge(false)
            renderDatabases()
            appendTerminal(sess, `\n<span class="terminal-line-info">=> [Connection Closed]\n</span>`)
            if (sess.unlisten) {
                sess.unlisten()
                sess.unlisten = null
            }
            return
        }

        if (event_type === 'error') {
            appendTerminal(sess, `<span class="terminal-line-error">${escapeHtml(text)}</span>`)
            return
        }

        appendTerminal(sess, escapeHtml(text))

        // Detect password / OTP prompts
        sess.streamBuffer = (sess.streamBuffer + text).slice(-500)
        const lower = sess.streamBuffer.toLowerCase()

        if (lower.includes('password:') || lower.includes('enter password')) {
            showInputModal(`🔑 Password for ${db.label}`, 'password', sess)
            sess.streamBuffer = ''
        } else if (lower.includes('otp') || lower.includes('token:') || lower.includes('authenticator') || lower.includes('mfa') || lower.includes('security key')) {
            showInputModal(`📱 OTP for ${db.label}`, 'text', sess)
            sess.streamBuffer = ''
        }
    })

    // Invoke backend command
    try {
        await invoke('start_proxy', {
            request: {
                db_id: db.id,
                access_type: accessType,
                provider,
                port,
            }
        })
        showToast(`Proxy started for ${db.label}`, 'success')

        // Save port for persistence
        db.port = port
        try {
            await invoke('save_database', { db })
        } catch (saveErr) {
            console.error('Failed to save port:', saveErr)
        }
    } catch (err) {
        appendTerminal(sess, `<span class="terminal-line-error">Error: ${escapeHtml(String(err))}\n</span>`)
        sess.isRunning = false
        stopTimer(sess)
        updateConnectionUI(false)
        updateStatusBadge(false)
        showToast(`Failed to start proxy: ${err}`, 'error')
    }
}
