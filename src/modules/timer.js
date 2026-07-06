export function startTimer(sess) {
    // Clear any leaked interval from prior session
    if (sess.timerInterval) {
        clearInterval(sess.timerInterval)
    }
    // Bump session gen — stale closed events check this
    sess.sessionGen = (sess.sessionGen || 0) + 1

    sess.timerStart = Date.now()
    sess.timerInterval = setInterval(() => {
        if (!sess.timerStart) return
        updateTimerDisplay(sess)
    }, 1000)
    showTimerEl(true)
    updateTimerDisplay(sess)
}

export function stopTimer(sess) {
    if (sess.timerInterval) {
        clearInterval(sess.timerInterval)
        sess.timerInterval = null
    }
    sess.timerStart = null
    showTimerEl(false)
}

export function showTimerEl(show) {
    const timerEl = document.getElementById('connectTimer')
    if (timerEl) timerEl.style.display = show ? 'flex' : 'none'
}

export function updateTimerDisplay(sess) {
    const el = document.getElementById('timerDisplay')
    if (!el || !sess.timerStart) return
    const elapsed = Math.floor((Date.now() - sess.timerStart) / 1000)
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const secs = String(elapsed % 60).padStart(2, '0')
    el.textContent = `${mins}:${secs}`
}
