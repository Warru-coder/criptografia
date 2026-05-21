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

let masterPassword = '';
let eventSource = null;
let dirModeActive = false;

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

setupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const password = document.getElementById('setupPassword').value;
  const confirm = document.getElementById('setupConfirm').value;

  if (password !== confirm) {
    addLog('Passwords do not match', 'error');
    return;
  }

  try {
    const res = await fetch('/api/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (res.ok) {
      addLog('Vault created successfully', 'success');
      masterPassword = password;
      setupPanel.classList.add('hidden');
      mainPanel.classList.remove('hidden');
    } else {
      addLog(data.errors ? data.errors.join(', ') : data.error, 'error');
    }
  } catch (error) {
    addLog(`Setup failed: ${error.message}`, 'error');
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      masterPassword = password;
      loginPanel.classList.add('hidden');
      mainPanel.classList.remove('hidden');
      addLog('Vault unlocked', 'success');
      connectSSE();
    } else {
      addLog('Invalid password', 'error');
    }
  } catch (error) {
    addLog(`Login failed: ${error.message}`, 'error');
  }
});

logoutBtn.addEventListener('click', () => {
  masterPassword = '';
  mainPanel.classList.add('hidden');
  loginPanel.classList.remove('hidden');
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  addLog('Vault locked', 'info');
});

showDirBtn.addEventListener('click', () => {
  dirModeActive = !dirModeActive;
  fileMode.classList.toggle('hidden', dirModeActive);
  dirMode.classList.toggle('hidden', !dirModeActive);
  showDirBtn.textContent = dirModeActive ? 'File Mode' : 'Directory Mode';
});

clearLogBtn.addEventListener('click', () => {
  logEntries.innerHTML = '';
});

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

function handleFiles(files) {
  for (const file of files) {
    addFileToList(file);
  }
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

  if (encryptBtn) {
    encryptBtn.addEventListener('click', () => processFile(item, 'encrypt'));
  }
  if (decryptBtn) {
    decryptBtn.addEventListener('click', () => processFile(item, 'decrypt'));
  }
  removeBtn.addEventListener('click', () => item.remove());

  fileList.appendChild(item);
}

async function processFile(item, action) {
  const file = item._file;
  const btn = item.querySelector('.btn-primary');

  btn.disabled = true;
  btn.textContent = 'Processing...';
  progressContainer.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = '0%';
  progressLabel.textContent = action === 'encrypt' ? 'Encrypting...' : 'Decrypting...';
  progressDetail.textContent = file.name;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', masterPassword);

  try {
    const res = await fetch(`/api/${action}`, {
      method: 'POST',
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
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      progressFill.style.width = '100%';
      progressText.textContent = '100%';
      addLog(`${action === 'encrypt' ? 'Encrypted' : 'Decrypted'}: ${file.name} → ${downloadName}`, 'success');
    } else {
      const data = await res.json();
      addLog(`${action} failed: ${data.error}`, 'error');
    }
  } catch (error) {
    addLog(`${action} failed: ${error.message}`, 'error');
  }

  btn.disabled = false;
  btn.textContent = action === 'encrypt' ? 'Encrypt' : 'Decrypt';
}

async function processDirectory(action) {
  const inputPath = dirInput.value.trim();
  const outputPath = dirOutput.value.trim() || undefined;

  if (!inputPath) {
    addLog('Please enter a directory path', 'error');
    return;
  }

  const btn = action === 'encrypt' ? encryptDirBtn : decryptDirBtn;
  btn.disabled = true;
  btn.textContent = 'Processing...';
  progressContainer.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = '0%';
  progressLabel.textContent = action === 'encrypt' ? 'Encrypting directory...' : 'Decrypting directory...';
  progressDetail.textContent = inputPath;

  try {
    const res = await fetch(`/api/${action}-dir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: masterPassword,
        inputPath,
        outputPath,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      progressFill.style.width = '100%';
      progressText.textContent = '100%';
      progressDetail.textContent = `Output: ${data.result.outputDir} | Files: ${data.result.processedFiles}`;
      addLog(`${action === 'encrypt' ? 'Encrypted' : 'Decrypted'} directory: ${inputPath} (${data.result.processedFiles} files)`, 'success');

      if (data.result.failedFiles > 0) {
        addLog(`Failed files: ${data.result.failedFiles}`, 'error');
      }
    } else {
      addLog(`Directory ${action} failed: ${data.error}`, 'error');
    }
  } catch (error) {
    addLog(`Directory ${action} failed: ${error.message}`, 'error');
  }

  btn.disabled = false;
  btn.textContent = action === 'encrypt' ? 'Encrypt Directory' : 'Decrypt Directory';
}

encryptDirBtn.addEventListener('click', () => processDirectory('encrypt'));
decryptDirBtn.addEventListener('click', () => processDirectory('decrypt'));

function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/progress');

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);

      if (data.percentage !== undefined) {
        progressFill.style.width = `${data.percentage}%`;
        progressText.textContent = `${data.percentage}%`;
      }

      if (data.currentFilename) {
        progressDetail.textContent = `${data.currentFile}/${data.totalFiles}: ${data.currentFilename}`;
      }

      if (data.type === 'encrypt' || data.type === 'decrypt') {
        progressLabel.textContent = data.type === 'encrypt' ? 'Encrypting...' : 'Decrypting...';
      }
    } catch {
      // ignore parse errors
    }
  };

  eventSource.onerror = () => {
    // browser will auto-reconnect
  };
}

function addLog(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  logEntries.prepend(entry);

  if (logEntries.children.length > 100) {
    logEntries.removeChild(logEntries.lastChild);
  }
}

checkVaultStatus();
