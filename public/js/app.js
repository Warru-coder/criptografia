// DOM refs — auth panels
const registerPanel = document.getElementById('registerPanel');
const loginPanel = document.getElementById('loginPanel');
const mainPanel = document.getElementById('mainPanel');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const passkeySection = document.getElementById('passkeySection');
const passkeyLoginBtn = document.getElementById('passkeyLoginBtn');
const switchToLogin = document.getElementById('switchToLogin');
const switchToRegister = document.getElementById('switchToRegister');
const switchToRegisterWrap = document.getElementById('switchToRegisterWrap');
const registerPasskeyBtn = document.getElementById('registerPasskeyBtn');
const loggedInUser = document.getElementById('loggedInUser');

// DOM refs — main
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressLabel = document.getElementById('progressLabel');
const progressDetail = document.getElementById('progressDetail');
const speedMeter = document.getElementById('speedMeter');
const speedValue = document.getElementById('speedValue');
const elapsedTime = document.getElementById('elapsedTime');
const logEntries = document.getElementById('logEntries');
const logoutBtn = document.getElementById('logoutBtn');
const showDirBtn = document.getElementById('showDirBtn');
const fileMode = document.getElementById('fileMode');
const dirMode = document.getElementById('dirMode');
const encryptDirBtn = document.getElementById('encryptDirBtn');
const decryptDirBtn = document.getElementById('decryptDirBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const dirInput = document.getElementById('dirInput');
const dirOutput = document.getElementById('dirOutput');

// DOM refs — AI panel
const showAiBtn = document.getElementById('showAiBtn');
const aiPanel = document.getElementById('aiPanel');
const aiStatusBadge = document.getElementById('aiStatusBadge');
const auditBtn = document.getElementById('auditBtn');
const configInput = document.getElementById('configInput');
const auditResults = document.getElementById('auditResults');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatHistory = document.getElementById('chatHistory');
const aiTabBtns = document.querySelectorAll('.ai-tab-btn');

// State
let sessionToken = null;
let currentUserId = null;
let currentUsername = null;
let eventSource = null;
let dirModeActive = false;
let aiPanelActive = false;
let startTime = null;
let totalBytesProcessed = 0;
let chatMessages = [];
let appStatus = { hasUsers: false, registrationEnabled: true, webauthnEnabled: false, aiEnabled: false };

// ─── Matrix Rain ──────────────────────────────────────────────────────────────

const canvas = document.getElementById('matrixCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?/~`SCRYPT';
const fontSize = 14;
let columns = Math.floor(canvas.width / fontSize);
let drops = Array(columns).fill(1);

function drawMatrix() {
  ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = fontSize + 'px monospace';
  for (let i = 0; i < drops.length; i++) {
    const text = chars[Math.floor(Math.random() * chars.length)];
    if (Math.random() > 0.98) ctx.fillStyle = '#ffffff';
    else if (Math.random() > 0.9) ctx.fillStyle = '#00cc33';
    else ctx.fillStyle = `rgba(0, ${150 + Math.floor(Math.random() * 105)}, ${Math.floor(Math.random() * 65)}, ${0.3 + Math.random() * 0.7})`;
    ctx.fillText(text, i * fontSize, drops[i] * fontSize);
    if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}
setInterval(drawMatrix, 50);
window.addEventListener('resize', () => { columns = Math.floor(canvas.width / fontSize); drops = Array(columns).fill(1); });

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function authHeaders(extra = {}) {
  return { 'Authorization': `Bearer ${sessionToken}`, ...extra };
}

function handleUnauthorized() {
  sessionToken = null;
  currentUserId = null;
  currentUsername = null;
  mainPanel.classList.add('hidden');
  showLoginOrRegister();
  addLog('Session expired — please sign in again', 'error');
}

async function apiFetch(url, options = {}) {
  if (sessionToken && !(options.headers && options.headers['Authorization'])) {
    options.headers = { ...options.headers, ...authHeaders() };
  }
  const res = await fetch(url, options);
  if (res.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
  return res;
}

// ─── App status & routing ─────────────────────────────────────────────────────

async function loadAppStatus() {
  try {
    const res = await fetch('/api/status');
    appStatus = await res.json();
  } catch { /* server unreachable, use defaults */ }
  showLoginOrRegister();
}

function showLoginOrRegister() {
  registerPanel.classList.add('hidden');
  loginPanel.classList.add('hidden');
  mainPanel.classList.add('hidden');

  if (!appStatus.hasUsers && appStatus.registrationEnabled) {
    registerPanel.classList.remove('hidden');
    switchToRegisterWrap && (switchToRegisterWrap.style.display = 'none');
  } else {
    loginPanel.classList.remove('hidden');
    // Show passkey button if WebAuthn is enabled
    if (passkeySection) passkeySection.classList.toggle('hidden', !appStatus.webauthnEnabled);
    // Show register link if registration is still open
    if (switchToRegisterWrap) switchToRegisterWrap.style.display = appStatus.registrationEnabled ? '' : 'none';
  }
}

function onSessionEstablished(data, username) {
  sessionToken = data.sessionToken;
  currentUserId = data.userId;
  currentUsername = username;
  registerPanel.classList.add('hidden');
  loginPanel.classList.add('hidden');
  mainPanel.classList.remove('hidden');
  if (loggedInUser) loggedInUser.textContent = username;
  // Show passkey registration button if WebAuthn is enabled
  if (registerPasskeyBtn) registerPasskeyBtn.classList.toggle('hidden', !appStatus.webauthnEnabled);
  connectSSE();
  if (appStatus.aiEnabled) checkAiStatus();
}

// Panel switch links
if (switchToLogin) {
  switchToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerPanel.classList.add('hidden');
    loginPanel.classList.remove('hidden');
    if (passkeySection) passkeySection.classList.toggle('hidden', !appStatus.webauthnEnabled);
  });
}
if (switchToRegister) {
  switchToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginPanel.classList.add('hidden');
    registerPanel.classList.remove('hidden');
  });
}

// ─── Register ─────────────────────────────────────────────────────────────────

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerConfirm').value;

  if (password !== confirm) { addLog('ERROR: Passwords do not match', 'error'); return; }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      addLog(`ERROR: ${data.errors ? data.errors.join(', ') : data.error}`, 'error');
      return;
    }
    appStatus.hasUsers = true;
    addLog(`Account created — welcome, ${username}!`, 'success');
    onSessionEstablished(data, username);
  } catch (err) {
    addLog(`ERROR: Registration failed — ${err.message}`, 'error');
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      addLog(`Vault unlocked — welcome back, ${username}!`, 'success');
      onSessionEstablished(data, username);
    } else {
      addLog(`ERROR: ${data.error}`, 'error');
    }
  } catch (err) {
    addLog(`ERROR: Connection failed — ${err.message}`, 'error');
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────

logoutBtn.addEventListener('click', async () => {
  if (sessionToken) {
    try { await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }); } catch { /* ignore */ }
  }
  sessionToken = null; currentUserId = null; currentUsername = null;
  mainPanel.classList.add('hidden');
  if (eventSource) { eventSource.close(); eventSource = null; }
  addLog('Vault locked — session terminated', 'info');
  showLoginOrRegister();
});

// ─── WebAuthn ─────────────────────────────────────────────────────────────────

// Register passkey (requires active session)
if (registerPasskeyBtn) {
  registerPasskeyBtn.addEventListener('click', async () => {
    try {
      const optRes = await apiFetch('/api/auth/webauthn/registration-options', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      });
      if (!optRes.ok) { const d = await optRes.json(); addLog(`ERROR: ${d.error}`, 'error'); return; }
      const options = await optRes.json();

      options.challenge = base64URLToBuffer(options.challenge);
      options.user.id = base64URLToBuffer(options.user.id);
      if (options.excludeCredentials) {
        options.excludeCredentials = options.excludeCredentials.map(c => ({ ...c, id: base64URLToBuffer(c.id) }));
      }

      const credential = await navigator.credentials.create({ publicKey: options });
      if (!credential) { addLog('ERROR: Passkey creation cancelled', 'error'); return; }

      const verRes = await apiFetch('/api/auth/webauthn/registration-verify', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(credentialToJSON(credential)),
      });
      const verData = await verRes.json();
      if (verRes.ok && verData.verified) {
        addLog('Passkey registered successfully!', 'success');
        registerPasskeyBtn.textContent = 'Passkey Registered ✓';
        registerPasskeyBtn.disabled = true;
      } else {
        addLog(`ERROR: ${verData.error}`, 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') addLog(`ERROR: Passkey registration failed — ${err.message}`, 'error');
    }
  });
}

// Passkey login
if (passkeyLoginBtn) {
  passkeyLoginBtn.addEventListener('click', async () => {
    const username = document.getElementById('loginUsername').value.trim();
    if (!username) { addLog('ERROR: Enter your username first', 'error'); return; }

    try {
      const optRes = await fetch('/api/auth/webauthn/authentication-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!optRes.ok) { const d = await optRes.json(); addLog(`ERROR: ${d.error}`, 'error'); return; }
      const options = await optRes.json();
      const userId = options.userId;

      options.challenge = base64URLToBuffer(options.challenge);
      if (options.allowCredentials) {
        options.allowCredentials = options.allowCredentials.map(c => ({ ...c, id: base64URLToBuffer(c.id) }));
      }

      const assertion = await navigator.credentials.get({ publicKey: options });
      if (!assertion) { addLog('ERROR: Passkey authentication cancelled', 'error'); return; }

      const verRes = await fetch('/api/auth/webauthn/authentication-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, response: assertionToJSON(assertion) }),
      });
      const verData = await verRes.json();
      if (verRes.ok) {
        addLog(`Passkey login successful — welcome, ${username}!`, 'success');
        onSessionEstablished(verData, username);
      } else {
        addLog(`ERROR: ${verData.error}`, 'error');
      }
    } catch (err) {
      addLog(`ERROR: Passkey login failed — ${err.message}`, 'error');
    }
  });
}

// WebAuthn helpers
function base64URLToBuffer(b64) {
  const b = b64.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b);
  return Uint8Array.from(raw, c => c.charCodeAt(0)).buffer;
}

function bufferToBase64URL(buf) {
  const bytes = new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function credentialToJSON(cred) {
  return {
    id: cred.id,
    rawId: bufferToBase64URL(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64URL(cred.response.clientDataJSON),
      attestationObject: bufferToBase64URL(cred.response.attestationObject),
    },
  };
}

function assertionToJSON(assertion) {
  return {
    id: assertion.id,
    rawId: bufferToBase64URL(assertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON: bufferToBase64URL(assertion.response.clientDataJSON),
      authenticatorData: bufferToBase64URL(assertion.response.authenticatorData),
      signature: bufferToBase64URL(assertion.response.signature),
      userHandle: assertion.response.userHandle ? bufferToBase64URL(assertion.response.userHandle) : null,
    },
  };
}

// ─── Directory mode toggle ────────────────────────────────────────────────────

showDirBtn.addEventListener('click', () => {
  dirModeActive = !dirModeActive;
  fileMode.classList.toggle('hidden', dirModeActive);
  dirMode.classList.toggle('hidden', !dirModeActive);
  showDirBtn.textContent = dirModeActive ? 'File Mode' : 'Directory Mode';
});

// ─── AI panel toggle ──────────────────────────────────────────────────────────

if (showAiBtn) {
  showAiBtn.addEventListener('click', () => {
    aiPanelActive = !aiPanelActive;
    aiPanel.classList.toggle('hidden', !aiPanelActive);
    showAiBtn.textContent = aiPanelActive ? 'Hide AI' : 'AI Advisor';
    if (aiPanelActive) checkAiStatus();
  });
}

aiTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    aiTabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.ai-tab-content').forEach(c => c.classList.add('hidden'));
    const target = document.getElementById(btn.dataset.tab + 'Tab');
    if (target) target.classList.remove('hidden');
  });
});

clearLogBtn.addEventListener('click', () => { logEntries.innerHTML = ''; addLog('Log cleared', 'info'); });

// ─── File drop zone ───────────────────────────────────────────────────────────

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(files) { for (const f of files) addFileToList(f); }

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function addFileToList(file) {
  const item = document.createElement('div');
  item.className = 'file-item';
  const isEncrypted = file.name.endsWith('.scrypt');
  item.innerHTML = `
    <span class="name" title="${file.name}">${file.name}</span>
    <span class="size">${formatSize(file.size)}</span>
    <span class="classify-badge-slot"></span>
    <div class="actions">
      ${!isEncrypted ? '<button class="btn btn-primary btn-encrypt">Encrypt</button>' : ''}
      ${isEncrypted ? '<button class="btn btn-primary btn-decrypt">Decrypt</button>' : ''}
      <button class="btn btn-secondary btn-remove">Remove</button>
    </div>
  `;
  item._file = file;
  const encryptBtn = item.querySelector('.btn-encrypt');
  const decryptBtn = item.querySelector('.btn-decrypt');
  const removeBtn = item.querySelector('.btn-remove');
  if (encryptBtn) encryptBtn.addEventListener('click', () => processFile(item, 'encrypt'));
  if (decryptBtn) decryptBtn.addEventListener('click', () => processFile(item, 'decrypt'));
  removeBtn.addEventListener('click', () => item.remove());
  fileList.appendChild(item);

  // Classify in background — never blocks encrypt/decrypt flow
  if (!isEncrypted && sessionToken) {
    classifyAndBadge(file, item.querySelector('.classify-badge-slot'));
  }
}

async function classifyAndBadge(file, slot) {
  try {
    const res = await apiFetch('/api/ai/classify-file', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, sizeBytes: file.size, mimeType: file.type || undefined }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.available || !slot) return;

    const badge = document.createElement('span');
    if (data.sensitive) {
      badge.className = 'classify-badge sensitive';
      badge.title = `${data.category} — ${data.reason}\n${data.recommendation}`;
      badge.innerHTML = `<i class="badge-icon">⚠</i> ${data.category}`;
    } else {
      badge.className = 'classify-badge not-sensitive';
      badge.title = `${data.category} — ${data.reason}`;
      badge.innerHTML = `<i class="badge-icon">✓</i> ${data.category}`;
    }
    slot.appendChild(badge);
  } catch {
    // Silent fail — classification is best-effort
  }
}

async function processFile(item, action) {
  const file = item._file;
  const btn = item.querySelector('.btn-primary');
  btn.disabled = true; btn.textContent = 'Processing...';
  progressContainer.classList.remove('hidden');
  speedMeter.classList.remove('hidden');
  progressFill.style.width = '0%'; progressText.textContent = '0%';
  progressLabel.textContent = action === 'encrypt' ? '[ENCRYPTING]' : '[DECRYPTING]';
  progressDetail.textContent = file.name;
  startTime = Date.now(); totalBytesProcessed = 0;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await apiFetch(`/api/${action}`, { method: 'POST', headers: authHeaders(), body: formData });
    if (res.ok) {
      const contentDisposition = res.headers.get('Content-Disposition');
      let downloadName = action === 'encrypt' ? file.name + '.scrypt' : file.name.replace('.scrypt', '');
      if (contentDisposition) { const m = contentDisposition.match(/filename="?(.+?)"?$/); if (m) downloadName = m[1]; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = downloadName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      progressFill.style.width = '100%'; progressText.textContent = '100%';
      addLog(`${action === 'encrypt' ? 'ENCRYPTED' : 'DECRYPTED'}: ${file.name} → ${downloadName} [${duration}s]`, 'success');
    } else {
      const data = await res.json();
      addLog(`ERROR: ${action} failed — ${data.error}`, 'error');
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') addLog(`ERROR: ${action} failed — ${err.message}`, 'error');
  }
  btn.disabled = false; btn.textContent = action === 'encrypt' ? 'Encrypt' : 'Decrypt';
  speedMeter.classList.add('hidden');
}

async function processDirectory(action) {
  const inputPath = dirInput.value.trim();
  const outputPath = dirOutput.value.trim() || undefined;
  if (!inputPath) { addLog('ERROR: Please enter a directory path', 'error'); return; }
  const btn = action === 'encrypt' ? encryptDirBtn : decryptDirBtn;
  btn.disabled = true; btn.textContent = 'Processing...';
  progressContainer.classList.remove('hidden'); speedMeter.classList.remove('hidden');
  progressFill.style.width = '0%'; progressText.textContent = '0%';
  progressLabel.textContent = action === 'encrypt' ? '[ENCRYPTING DIR]' : '[DECRYPTING DIR]';
  progressDetail.textContent = inputPath; startTime = Date.now();
  try {
    const res = await apiFetch(`/api/${action}-dir`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ inputPath, outputPath }),
    });
    const data = await res.json();
    if (res.ok) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      progressFill.style.width = '100%'; progressText.textContent = '100%';
      progressDetail.textContent = `Output: ${data.result.outputDir} | Files: ${data.result.processedFiles} [${duration}s]`;
      addLog(`${action === 'encrypt' ? 'ENCRYPTED' : 'DECRYPTED'} directory: ${inputPath} (${data.result.processedFiles} files) [${duration}s]`, 'success');
      if (data.result.failedFiles > 0) addLog(`WARNING: ${data.result.failedFiles} files failed`, 'error');
    } else {
      addLog(`ERROR: Directory ${action} failed — ${data.error}`, 'error');
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') addLog(`ERROR: Directory ${action} failed — ${err.message}`, 'error');
  }
  btn.disabled = false; btn.textContent = action === 'encrypt' ? 'Encrypt Directory' : 'Decrypt Directory';
  speedMeter.classList.add('hidden');
}

encryptDirBtn.addEventListener('click', () => processDirectory('encrypt'));
decryptDirBtn.addEventListener('click', () => processDirectory('decrypt'));

// ─── SSE progress ─────────────────────────────────────────────────────────────

function connectSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/api/progress');
  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.percentage !== undefined) { progressFill.style.width = `${data.percentage}%`; progressText.textContent = `${data.percentage}%`; }
      if (data.currentFilename) progressDetail.textContent = `[${data.currentFile}/${data.totalFiles}] ${data.currentFilename}`;
      if (data.bytesProcessed !== undefined && startTime) {
        totalBytesProcessed = data.bytesProcessed;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = totalBytesProcessed / (1024 * 1024) / elapsed;
        speedValue.textContent = speed.toFixed(2) + ' MB/s';
        const mins = Math.floor(elapsed / 60), secs = Math.floor(elapsed % 60);
        elapsedTime.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
      }
    } catch { /* ignore parse errors */ }
  };
}

// ─── Activity log ─────────────────────────────────────────────────────────────

function addLog(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  entry.textContent = `[${ts}] ${message}`;
  logEntries.prepend(entry);
  if (logEntries.children.length > 100) logEntries.removeChild(logEntries.lastChild);
}

// ─── AI Panel ────────────────────────────────────────────────────────────────

async function checkAiStatus() {
  if (!aiStatusBadge) return;
  try {
    const res = await fetch('/api/ai/status');
    const data = await res.json();
    aiStatusBadge.textContent = data.available ? `● ${data.model}` : '○ Template mode';
    aiStatusBadge.className = 'ai-status-badge ' + (data.available ? 'ai-online' : 'ai-offline');
  } catch {
    aiStatusBadge.textContent = '○ Unavailable';
    aiStatusBadge.className = 'ai-status-badge ai-offline';
  }
}

if (auditBtn) {
  auditBtn.addEventListener('click', async () => {
    const raw = configInput.value.trim();
    if (!raw) { addLog('ERROR: Paste a JSON config to audit', 'error'); return; }
    let config;
    try { config = JSON.parse(raw); } catch { addLog('ERROR: Invalid JSON', 'error'); return; }
    auditBtn.disabled = true; auditBtn.textContent = 'Auditing...';
    auditResults.classList.add('hidden');
    try {
      const res = await apiFetch('/api/ai/audit', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(config) });
      const data = await res.json();
      if (res.ok) renderAuditResults(data);
      else addLog(`ERROR: Audit failed — ${data.error}`, 'error');
    } catch (err) {
      if (err.message !== 'Unauthorized') addLog(`ERROR: Audit failed — ${err.message}`, 'error');
    }
    auditBtn.disabled = false; auditBtn.textContent = 'Audit Configuration';
  });
}

function renderAuditResults(result) {
  // CSP-safe: colors come from CSS classes (.risk-low/.risk-medium/.risk-high/.risk-critical)
  // instead of inline style="color:..."
  const riskClass = ['low', 'medium', 'high', 'critical'].includes(result.riskLevel)
    ? `risk-${result.riskLevel}`
    : 'risk-unknown';
  let html = `
    <div class="audit-header">
      <span class="risk-badge ${riskClass}">${result.riskLevel.toUpperCase()}</span>
      <span class="audit-score">Score: <strong>${result.score}/100</strong></span>
      <span class="audit-date">${new Date(result.checkedAt).toLocaleTimeString()}</span>
    </div>
    <p class="audit-summary">${result.summary}</p>
  `;
  if (result.compliantWith.length > 0) html += `<p class="audit-compliant">&#x2713; Compliant with: ${result.compliantWith.join(', ')}</p>`;
  if (result.findings.length > 0) {
    html += '<div class="findings-list">';
    for (const f of result.findings) {
      html += `
        <div class="finding-card sev-${f.severity}">
          <div class="finding-header">
            <span class="finding-id">${f.id}</span>
            <span class="finding-sev sev-${f.severity}">${f.severity.toUpperCase()}</span>
            <span class="finding-title">${f.title}</span>
          </div>
          <p class="finding-desc">${f.description}</p>
          ${f.currentValue ? `<p class="finding-val">Current: <code>${f.currentValue}</code> → Expected: <code>${f.expectedValue}</code></p>` : ''}
          <p class="finding-rec">&#x21B3; ${f.recommendation}</p>
          <p class="finding-ref">Ref: ${f.reference}</p>
        </div>
      `;
    }
    html += '</div>';
  }
  if (result.aiAnalysis) html += `<div class="ai-analysis"><span class="ai-label">AI Analysis</span><p>${result.aiAnalysis}</p></div>`;
  auditResults.innerHTML = html;
  auditResults.classList.remove('hidden');
}

async function sendChat() {
  if (!chatInput) return;
  const message = chatInput.value.trim();
  if (!message) return;
  appendChatMessage('user', message);
  chatInput.value = '';
  chatSendBtn.disabled = true; chatSendBtn.textContent = '...';
  const typingEl = appendChatMessage('assistant', '▋', true);
  try {
    const res = await apiFetch('/api/ai/chat', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message, history: chatMessages.slice(-10) }),
    });
    const data = await res.json();
    typingEl.remove();
    if (res.ok) {
      appendChatMessage('assistant', data.answer);
      chatMessages.push({ role: 'user', content: message }, { role: 'assistant', content: data.answer });
      if (chatMessages.length > 20) chatMessages = chatMessages.slice(-20);
      if (data.sources && data.sources.length > 0) {
        const srcEl = document.createElement('div');
        srcEl.className = 'chat-sources';
        srcEl.textContent = 'Sources: ' + data.sources.map(s => s.title).join(', ');
        chatHistory.appendChild(srcEl);
      }
    } else {
      appendChatMessage('assistant', `Error: ${data.error}`);
    }
  } catch (err) {
    typingEl.remove();
    if (err.message !== 'Unauthorized') appendChatMessage('assistant', `Error: ${err.message}`);
  }
  chatSendBtn.disabled = false; chatSendBtn.textContent = 'Send';
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function appendChatMessage(role, text, isTyping = false) {
  const el = document.createElement('div');
  el.className = `chat-msg chat-${role}${isTyping ? ' typing' : ''}`;
  el.innerHTML = `<span class="chat-role">${role === 'user' ? 'YOU' : 'AI'}</span><span class="chat-text">${text.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</span>`;
  chatHistory.appendChild(el);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return el;
}

if (chatSendBtn) chatSendBtn.addEventListener('click', sendChat);
if (chatInput) chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });

// ─── Init ─────────────────────────────────────────────────────────────────────

loadAppStatus();
