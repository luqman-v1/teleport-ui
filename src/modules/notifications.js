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
