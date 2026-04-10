let databases = [];
let currentDb = null;

// Store state per database. key = db.id
const sessions = {};

const dbListEl = document.getElementById('dbList');
const welcomeScreen = document.getElementById('welcomeScreen');
const connectScreen = document.getElementById('connectScreen');
const inputOverlay = document.getElementById('inputOverlay');
const terminalContainer = document.querySelector('.terminal-container');
const terminalInput = document.getElementById('terminalInput');

// Fetch DBs
async function loadDatabases() {
    const res = await fetch('/api/databases');
    databases = await res.json();
    renderDatabases();
}

function renderDatabases() {
    dbListEl.innerHTML = '';
    databases.forEach(db => {
        // Init session state if not exists
        if (!sessions[db.id]) {
            const tDiv = document.createElement('div');
            tDiv.className = 'terminal-output';
            tDiv.style.display = 'none'; // hidden by default
            terminalContainer.insertBefore(tDiv, inputOverlay);

            sessions[db.id] = {
                ws: null,
                streamBuffer: '',
                isRunning: false,
                terminalDiv: tDiv,
                port: '6666'
            };
        }

        const item = document.createElement('div');
        item.className = 'db-item';
        // Add a status indicator dot
        const dotColor = sessions[db.id].isRunning ? 'var(--success)' : 'transparent';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4>${db.label}</h4>
                <div style="display:flex; gap:8px; align-items:center;">
                    <div style="width:8px; height:8px; border-radius:50%; background:${dotColor};"></div>
                    <button type="button" class="delete-btn" onclick="deleteDatabase(event, '${db.id}')" title="Delete Database">🗑️</button>
                </div>
            </div>
            <p>${db.db_name}</p>
        `;
        item.onclick = () => selectDatabase(db, item);
        dbListEl.appendChild(item);
    });
}

function selectDatabase(db, element) {
    document.querySelectorAll('.db-item').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    
    currentDb = db;
    welcomeScreen.classList.remove('active');
    connectScreen.classList.add('active');
    
    document.getElementById('selectedDbTitle').innerText = db.label;
    document.getElementById('selectedDbInstance').innerText = db.db_instance;
    
    const sess = sessions[db.id];

    // Hide all terminal divs, show the current one
    Object.values(sessions).forEach(s => s.terminalDiv.style.display = 'none');
    sess.terminalDiv.style.display = 'block';

    // Set port input value to this session's last known port
    document.getElementById('localPort').value = sess.port;

    if (sess.isRunning) {
        document.getElementById('startBtn').classList.add('hidden');
        document.getElementById('stopBtn').classList.remove('hidden');
    } else {
        document.getElementById('startBtn').classList.remove('hidden');
        document.getElementById('stopBtn').classList.add('hidden');
    }
}

// Connect logic
document.getElementById('connectForm').onsubmit = (e) => {
    e.preventDefault();
    if(!currentDb) return;

    const accessType = document.getElementById('accessType').value;
    const provider = document.getElementById('provider').value;
    const port = document.getElementById('localPort').value;

    startProxySession(currentDb, accessType, provider, port);
};

document.getElementById('stopBtn').onclick = () => {
    if(!currentDb) return;
    const sess = sessions[currentDb.id];
    if(sess && sess.ws) {
        sess.ws.close(); // This will trigger onclose
    }
}

function startProxySession(db, accessType, provider, port) {
    const sess = sessions[db.id];
    sess.port = port;
    sess.isRunning = true;
    
    // Update UI immediately for current DB
    if (currentDb && currentDb.id === db.id) {
        document.getElementById('startBtn').classList.add('hidden');
        document.getElementById('stopBtn').classList.remove('hidden');
    }
    
    renderDatabases(); // update green dots

    sess.terminalDiv.innerHTML = `=> Connecting ${db.label} on port ${port}...\n`;
    
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    sess.ws = new WebSocket(`${wsProto}//${location.host}/api/connect`);

    sess.ws.onopen = () => {
        sess.ws.send(JSON.stringify({ access_type: accessType, provider, db_id: db.id, port }));
    };

    sess.ws.onmessage = async (e) => {
        let text = typeof e.data === 'string' ? e.data : await e.data.text();
        
        // Strip ANSI
        text = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        text = text.replace(/\x1b\][0-9;]*[^\x1b]*\x1b\\/g, '');
        text = text.replace(/\x1b/g, '');
        text = text.replace(/\]11;\?\\(?:\[6n)?/g, '');
        text = text.replace(/\[\d{1,2}m/g, '');
        
        const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        sess.terminalDiv.innerHTML += safeText;
        sess.terminalDiv.scrollTop = sess.terminalDiv.scrollHeight;

        sess.streamBuffer += text;
        const lowerText = sess.streamBuffer.toLowerCase();
        
        // Password Prompts
        if (lowerText.includes("password:") || lowerText.includes("enter password")) {
            showInputModal(`🔑 Password for ${db.label}`, "password", sess);
            sess.streamBuffer = "";
        } 
        // OTP Prompts
        else if (lowerText.includes("otp") || lowerText.includes("token:") || lowerText.includes("authenticator") || lowerText.includes("mfa") || lowerText.includes("security key")) {
            showInputModal(`📱 OTP Token for ${db.label}`, "text", sess);
            sess.streamBuffer = "";
        }
    };

    sess.ws.onclose = () => {
        sess.isRunning = false;
        renderDatabases(); // Remove green dot
        sess.terminalDiv.innerHTML += '\n=> [Connection Closed]\n';
        
        if (currentDb && currentDb.id === db.id) {
            document.getElementById('startBtn').classList.remove('hidden');
            document.getElementById('stopBtn').classList.add('hidden');
        }
    };
}

let submitAction = null;

function showInputModal(title, type="password", sess) {
    document.getElementById('inputPromptLabel').innerText = title;
    terminalInput.type = type;
    terminalInput.value = '';
    inputOverlay.classList.add('active');
    terminalInput.focus();

    submitAction = () => {
        if(!sess.ws) return;
        sess.ws.send(terminalInput.value + '\r');
        inputOverlay.classList.remove('active');
        
        if(type === 'password'){
            sess.terminalDiv.innerHTML += '********\n';
        } else {
            sess.terminalDiv.innerHTML += terminalInput.value + '\n';
        }
    };
}

document.getElementById('submitInputBtn').onclick = () => {
    if(submitAction) submitAction();
}

terminalInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter' && submitAction) {
        submitAction();
    }
});

async function deleteDatabase(e, id) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this database configuration?')) return;
    
    await fetch(`/api/databases?id=${id}`, { method: 'DELETE' });
    
    if (sessions[id] && sessions[id].ws) {
        sessions[id].ws.close();
    }
    
    if (currentDb && currentDb.id == id) {
        currentDb = null;
        document.getElementById('connectScreen').classList.remove('active');
        document.getElementById('welcomeScreen').classList.add('active');
    }
    
    loadDatabases();
}

// Add Modal Logic
document.getElementById('addDbBtn').onclick = () => {
    document.getElementById('addDbModal').classList.add('active');
}
document.getElementById('closeModalBtn').onclick = () => {
    document.getElementById('addDbModal').classList.remove('active');
}

document.getElementById('addDbForm').onsubmit = async (e) => {
    e.preventDefault();
    const newDb = {
        id: String(Date.now()),
        label: document.getElementById('newLabel').value,
        db_name: document.getElementById('newDbName').value,
        db_instance: document.getElementById('newDbInstance').value
    };

    await fetch('/api/databases', {
        method: 'POST',
        body: JSON.stringify(newDb),
        headers: { 'Content-Type': 'application/json' }
    });

    document.getElementById('addDbModal').classList.remove('active');
    document.getElementById('addDbForm').reset();
    loadDatabases();
};

// Settings Modal Logic
async function loadSettings() {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    document.getElementById('teleportProxy').value = cfg.teleport_proxy || "";
    document.getElementById('teleportUser').value = cfg.teleport_user || "";
}

document.getElementById('settingsBtn').onclick = () => {
    loadSettings();
    document.getElementById('settingsModal').classList.add('active');
}
document.getElementById('closeSettingsBtn').onclick = () => {
    document.getElementById('settingsModal').classList.remove('active');
}
document.getElementById('settingsForm').onsubmit = async (e) => {
    e.preventDefault();
    const cfg = {
        teleport_proxy: document.getElementById('teleportProxy').value,
        teleport_user: document.getElementById('teleportUser').value
    };
    await fetch('/api/config', {
        method: 'POST',
        body: JSON.stringify(cfg),
        headers: { 'Content-Type': 'application/json' }
    });
    document.getElementById('settingsModal').classList.remove('active');
};

// Initial load
loadDatabases();
