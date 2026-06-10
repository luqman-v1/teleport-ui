export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function showToast(message, type = 'info', duration = 3500) {
    const toastContainer = document.getElementById('toastContainer')
    if (!toastContainer) return

    const icons = { success: '✓', error: '✕', info: 'ℹ' }
    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span>${escapeHtml(message)}</span>
    `
    toastContainer.appendChild(toast)

    setTimeout(() => {
        toast.classList.add('toast-exit')
        toast.addEventListener('animationend', () => toast.remove())
    }, duration)
}
