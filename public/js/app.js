// DOM refs — core
const setupPanel = document.getElementById('setupPanel');
const loginPanel = document.getElementById('loginPanel');
const mainPanel = document.getElementById('mainPanel');
const setupForm = document.getElementById('setupForm');
const loginForm = document.getElementById('loginForm');
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
let eventSource = null;
let dirModeActive = false;
let aiPanelActive = false;
let startTime = null;
let totalBytesProcessed = 0;
let chatMessages = [];

// Matrix Rain
const canvas = document.getElementById('matrixCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?/~`SCRYPT';
const fontSize = 14;
let columns = Math.floor(canvas.width / fontSize);
let drops = Array(columns).fill(1);

function drawMatrix() {
  ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#00ff41';
  ctx.font = fontSize + 'px monospace';

  for (let i = 0; i < drops.length; i++) {
    const text = chars[Math.floor(Math.random() * chars.length)];
    const x = i * fontSize;
    const y = drops[i] * fontSize;

    if (Math.random() > 0.98) ctx.fillStyle = '#ffffff';
    else if (Math.random() > 0.9) ctx.fillStyle = '#00cc33';
    else ctx.fillStyle = `rgba(0, ${150 + Math.floor(Math.random() * 105)}, ${Math.floor(Math.random() * 65)}, ${0.3 + Math.random() * 0.7})`;

    ctx.fillText(text, x, y);
    if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}

setInterval(drawMatrix, 50);
window.addEventListener('resize', () => {
  columns = Math.floor(canvas.width / fontSize);
  drops = Array(columns).fill(1);
});

// Auth helpers
function authHeaders(extra = {}) {
  return { 'Authorization': `Bearer ${sessionToken}`, ...extra };
}

function handleUnauthorized() {
  sessionToken = null;
  mainPanel.classList.add('hidden');
  loginPanel.classList.remove('hidden');
  addLog('Session expired — please log in again', 'error');
}

async function apiFetch(url, options = {}) {
  if (sessionToken && !options.headers?.Authorization) {
    options.headers = { ...options.headers, ...authHeaders() };
  }
  const res = await fetch(url, options);
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }
  return res;
}

// Vault status check
async function checkVaultStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.vaultInitialized) {
      loginPanel.classList.remove('hidden');
    } else {
      setupPanel.classList.remove('hidden');
    }
  } catch {
    setupPanel.classList.remove('hidden');
  }
}

// Setup
setupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('setupPassword').value;
  const confirm = document.getElementById('setupConfirm').value;

  if (password !== confirm) {
    addLog('ERROR: Passwords do not match', 'error');
    return;
  }

  try {
    const initRes = await fetch('/api/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const initData = await initRes.json();
    if (!initRes.ok) {
      addLog(`ERROR: ${initData.errors ? initData.errors.join(', ') : initData.error}`, 'error');
      return;
    }

    // Auto-login after setup
    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      addLog('Vault created — please log in', 'success');
      setupPanel.classList.add('hidden');
      loginPanel.classList.remove('hidden');
      return;
    }

    sessionToken = loginData.sessionToken;
    addLog('Vault initialized — access granted', 'success');
    setupPanel.classList.add('hidden');
    mainPanel.classList.remove('hidden');
    connectSSE();
    checkAiStatus();
  } catch (error) {
    addLog(`ERROR: Setup failed — ${error.message}`, 'error');
  }
});

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      const data = await res.json();
      sessionToken = data.sessionToken;
      loginPanel.classList.add('hidden');
      mainPanel.classList.remove('hidden');
      addLog('Vault unlocked — access granted', 'success');
      connectSSE();
      checkAiStatus();
    } else {
      addLog('ERROR: Access denied — invalid password', 'error');
    }
  } catch (error) {
    addLog(`ERROR: Connection failed — ${error.message}`, 'error');
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  if (sessionToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch { /* ignore */ }
  }
  sessionToken = null;
  mainPanel.classList.add('hidden');
  loginPanel.classList.remove('hidden');
  if (eventSource) { eventSource.close(); eventSource = null; }
  addLog('Vault locked — session terminated', 'info');
});

// Directory mode toggle
showDirBtn.addEventListener('click', () => {
  dirModeActive = !dirModeActive;
  fileMode.classList.toggle('hidden', dirModeActive);
  dirMode.classList.toggle('hidden', !dirModeActive);
  showDirBtn.textContent = dirModeActive ? 'File Mode' : 'Directory Mode';
});

// AI panel toggle
if (showAiBtn) {
  showAiBtn.addEventListener('click', () => {
    aiPanelActive = !aiPanelActive;
    aiPanel.classList.toggle('hidden', !aiPanelActive);
    showAiBtn.textContent = aiPanelActive ? 'Hide AI' : 'AI Advisor';
    if (aiPanelActive) checkAiStatus();
  });
}

// AI tab switching
aiTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    aiTabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.ai-tab-content').forEach(c => c.classList.add('hidden'));
    const target = document.getElementById(btn.dataset.tab + 'Tab');
    if (target) target.classList.remove('hidden');
  });
});

clearLogBtn.addEventListener('click', () => {
  logEntries.innerHTML = '';
  addLog('Log cleared', 'info');
});

// File drop zone
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(files) {
  for (const file of files) addFileToList(file);
}

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
}

async function processFile(item, action) {
  const file = item._file;
  const btn = item.querySelector('.btn-primary');

  btn.disabled = true;
  btn.textContent = 'Processing...';
  progressContainer.classList.remove('hidden');
  speedMeter.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = '0%';
  progressLabel.textContent = action === 'encrypt' ? '[ENCRYPTING]' : '[DECRYPTING]';
  progressDetail.textContent = file.name;
  startTime = Date.now();
  totalBytesProcessed = 0;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await apiFetch(`/api/${action}`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });

    if (res.ok) {
      const contentDisposition = res.headers.get('Content-Disposition');
      let downloadName = action === 'encrypt' ? file.name + '.scrypt' : file.name.replace('.scrypt', '');
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/);
        if (match) downloadName = match[1];
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = downloadName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      progressFill.style.width = '100%';
      progressText.textContent = '100%';
      addLog(`${action === 'encrypt' ? 'ENCRYPTED' : 'DECRYPTED'}: ${file.name} → ${downloadName} [${duration}s]`, 'success');
    } else {
      const data = await res.json();
      addLog(`ERROR: ${action} failed — ${data.error}`, 'error');
    }
  } catch (error) {
    if (error.message !== 'Unauthorized') addLog(`ERROR: ${action} failed — ${error.message}`, 'error');
  }

  btn.disabled = false;
  btn.textContent = action === 'encrypt' ? 'Encrypt' : 'Decrypt';
  speedMeter.classList.add('hidden');
}

async function processDirectory(action) {
  const inputPath = dirInput.value.trim();
  const outputPath = dirOutput.value.trim() || undefined;
  if (!inputPath) { addLog('ERROR: Please enter a directory path', 'error'); return; }

  const btn = action === 'encrypt' ? encryptDirBtn : decryptDirBtn;
  btn.disabled = true;
  btn.textContent = 'Processing...';
  progressContainer.classList.remove('hidden');
  speedMeter.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = '0%';
  progressLabel.textContent = action === 'encrypt' ? '[ENCRYPTING DIR]' : '[DECRYPTING DIR]';
  progressDetail.textContent = inputPath;
  startTime = Date.now();

  try {
    const res = await apiFetch(`/api/${action}-dir`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ inputPath, outputPath }),
    });

    const data = await res.json();
    if (res.ok) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      progressFill.style.width = '100%';
      progressText.textContent = '100%';
      progressDetail.textContent = `Output: ${data.result.outputDir} | Files: ${data.result.processedFiles} [${duration}s]`;
      addLog(`${action === 'encrypt' ? 'ENCRYPTED' : 'DECRYPTED'} directory: ${inputPath} (${data.result.processedFiles} files) [${duration}s]`, 'success');
      if (data.result.failedFiles > 0) addLog(`WARNING: ${data.result.failedFiles} files failed`, 'error');
    } else {
      addLog(`ERROR: Directory ${action} failed — ${data.error}`, 'error');
    }
  } catch (error) {
    if (error.message !== 'Unauthorized') addLog(`ERROR: Directory ${action} failed — ${error.message}`, 'error');
  }

  btn.disabled = false;
  btn.textContent = action === 'encrypt' ? 'Encrypt Directory' : 'Decrypt Directory';
  speedMeter.classList.add('hidden');
}

encryptDirBtn.addEventListener('click', () => processDirectory('encrypt'));
decryptDirBtn.addEventListener('click', () => processDirectory('decrypt'));

// SSE progress
function connectSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/api/progress');
  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.percentage !== undefined) {
        progressFill.style.width = `${data.percentage}%`;
        progressText.textContent = `${data.percentage}%`;
      }
      if (data.currentFilename) {
        progressDetail.textContent = `[${data.currentFile}/${data.totalFiles}] ${data.currentFilename}`;
      }
      if (data.bytesProcessed !== undefined && startTime) {
        totalBytesProcessed = data.bytesProcessed;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = totalBytesProcessed / (1024 * 1024) / elapsed;
        speedValue.textContent = speed.toFixed(2) + ' MB/s';
        const mins = Math.floor(elapsed / 60);
        const secs = Math.floor(elapsed % 60);
        elapsedTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      if (data.type === 'encrypt' || data.type === 'decrypt') {
        progressLabel.textContent = data.type === 'encrypt' ? '[ENCRYPTING]' : '[DECRYPTING]';
      }
    } catch { /* ignore parse errors */ }
  };
}

// Activity log
function addLog(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  entry.textContent = `[${timestamp}] ${message}`;
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

// Config Auditor
if (auditBtn) {
  auditBtn.addEventListener('click', async () => {
    const raw = configInput.value.trim();
    if (!raw) { addLog('ERROR: Paste a JSON config to audit', 'error'); return; }

    let config;
    try { config = JSON.parse(raw); }
    catch { addLog('ERROR: Invalid JSON', 'error'); return; }

    auditBtn.disabled = true;
    auditBtn.textContent = 'Auditing...';
    auditResults.classList.add('hidden');

    try {
      const res = await apiFetch('/api/ai/audit', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok) renderAuditResults(data);
      else addLog(`ERROR: Audit failed — ${data.error}`, 'error');
    } catch (error) {
      if (error.message !== 'Unauthorized') addLog(`ERROR: Audit failed — ${error.message}`, 'error');
    }

    auditBtn.disabled = false;
    auditBtn.textContent = 'Audit Configuration';
  });
}

function renderAuditResults(result) {
  const riskColors = { low: '#00ff41', medium: '#ffcc00', high: '#ff8800', critical: '#ff0040' };
  const color = riskColors[result.riskLevel] || '#888';

  let html = `
    <div class="audit-header">
      <span class="risk-badge" style="color:${color};border-color:${color}">${result.riskLevel.toUpperCase()}</span>
      <span class="audit-score">Score: <strong>${result.score}/100</strong></span>
      <span class="audit-date">${new Date(result.checkedAt).toLocaleTimeString()}</span>
    </div>
    <p class="audit-summary">${result.summary}</p>
  `;

  if (result.compliantWith.length > 0) {
    html += `<p class="audit-compliant">✓ Compliant with: ${result.compliantWith.join(', ')}</p>`;
  }

  if (result.findings.length > 0) {
    html += '<div class="findings-list">';
    for (const f of result.findings) {
      const sev = f.severity;
      html += `
        <div class="finding-card sev-${sev}">
          <div class="finding-header">
            <span class="finding-id">${f.id}</span>
            <span class="finding-sev sev-${sev}">${sev.toUpperCase()}</span>
            <span class="finding-title">${f.title}</span>
          </div>
          <p class="finding-desc">${f.description}</p>
          ${f.currentValue ? `<p class="finding-val">Current: <code>${f.currentValue}</code> → Expected: <code>${f.expectedValue}</code></p>` : ''}
          <p class="finding-rec">↳ ${f.recommendation}</p>
          <p class="finding-ref">Ref: ${f.reference}</p>
        </div>
      `;
    }
    html += '</div>';
  }

  if (result.aiAnalysis) {
    html += `<div class="ai-analysis"><span class="ai-label">AI Analysis</span><p>${result.aiAnalysis}</p></div>`;
  }

  auditResults.innerHTML = html;
  auditResults.classList.remove('hidden');
}

// Chat Assistant
const EXAMPLE_CONFIG = JSON.stringify({ algorithm: 'AES-256-GCM', kdf: 'argon2id', kdfParams: { memoryCost: 65536, timeCost: 3, parallelism: 2 }, keyLength: 32, ivLength: 12, tagLength: 16, saltLength: 32 }, null, 2);

if (configInput && configInput.value === '') {
  configInput.placeholder = EXAMPLE_CONFIG;
}

async function sendChat() {
  if (!chatInput) return;
  const message = chatInput.value.trim();
  if (!message) return;

  appendChatMessage('user', message);
  chatInput.value = '';
  chatSendBtn.disabled = true;
  chatSendBtn.textContent = '...';

  const typingEl = appendChatMessage('assistant', '▋', true);

  try {
    const res = await apiFetch('/api/ai/chat', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message, history: chatMessages.slice(-10) }),
    });
    const data = await res.json();
    if (res.ok) {
      typingEl.remove();
      appendChatMessage('assistant', data.answer);
      chatMessages.push({ role: 'user', content: message });
      chatMessages.push({ role: 'assistant', content: data.answer });
      if (chatMessages.length > 20) chatMessages = chatMessages.slice(-20);

      if (data.sources && data.sources.length > 0) {
        const srcEl = document.createElement('div');
        srcEl.className = 'chat-sources';
        srcEl.textContent = 'Sources: ' + data.sources.map(s => s.title).join(', ');
        chatHistory.appendChild(srcEl);
      }
    } else {
      typingEl.remove();
      appendChatMessage('assistant', `Error: ${data.error}`);
    }
  } catch (error) {
    typingEl.remove();
    if (error.message !== 'Unauthorized') appendChatMessage('assistant', `Error: ${error.message}`);
  }

  chatSendBtn.disabled = false;
  chatSendBtn.textContent = 'Send';
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
if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
}

// Init
checkVaultStatus();
