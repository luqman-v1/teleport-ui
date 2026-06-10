import { state } from './state.js'
import { escapeHtml, showToast } from './utils.js'
import { invoke } from '@tauri-apps/api/core'

export function getOrCreateSession(db) {
    if (!state.sessions[db.id]) {
        const tDiv = document.createElement('div')
        tDiv.className = 'terminal-output'
        tDiv.style.display = 'none'
        
        const container = document.querySelector('.terminal-container')
        const inputOverlay = document.getElementById('inputOverlay')
        if (container && inputOverlay) {
            container.insertBefore(tDiv, inputOverlay)
        }

        state.sessions[db.id] = {
            isRunning: false,
            terminalDiv: tDiv,
            port: '6666',
            unlisten: null,
            timerStart: null,
            timerInterval: null,
            streamBuffer: ''
        }
    }
    return state.sessions[db.id]
}

export function appendTerminal(sess, html) {
    if (!sess.terminalDiv) return
    sess.terminalDiv.innerHTML += html
    // Smooth scroll to bottom
    requestAnimationFrame(() => {
        sess.terminalDiv.scrollTo({
            top: sess.terminalDiv.scrollHeight,
            behavior: 'smooth'
        })
    })
}

let submitAction = null

export function showInputModal(title, type = 'password', sess) {
    const inputOverlay = document.getElementById('inputOverlay')
    const terminalInput = document.getElementById('terminalInput')
    
    document.getElementById('inputPromptLabel').textContent = title
    terminalInput.type = type
    terminalInput.value = ''
    inputOverlay.classList.add('active')
    
    // Slight delay so the animation completes before focus
    setTimeout(() => terminalInput.focus(), 100)

    submitAction = async () => {
        const val = terminalInput.value
        inputOverlay.classList.remove('active')

        try {
            await invoke('send_input', { dbId: state.currentDb.id, input: val + '\r' })
        } catch (err) {
            console.error('Send input failed:', err)
            showToast('Failed to send input', 'error')
        }

        const echo = type === 'password' ? '●●●●●●●●\n' : escapeHtml(val) + '\n'
        appendTerminal(sess, `<span class="terminal-line-warn">${echo}</span>`)
        submitAction = null
    }
}

export function setupTerminalInput() {
    document.getElementById('submitInputBtn').addEventListener('click', () => {
        if (submitAction) submitAction()
    })

    document.getElementById('terminalInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && submitAction) submitAction()
    })
}

export function closeTerminalInput() {
    const inputOverlay = document.getElementById('inputOverlay')
    if (inputOverlay && inputOverlay.classList.contains('active')) {
        inputOverlay.classList.remove('active')
        submitAction = null
        return true
    }
    return false
}
