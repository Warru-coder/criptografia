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
const logEntries = document.getElementById('logEntries');
const logoutBtn = document.getElementById('logoutBtn');

let masterPassword = '';

async function checkVaultStatus() {
  try {
    const res = await fetch('/api/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '__check__' }),
    });

    if (res.status === 401) {
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
  addLog('Vault locked', 'success');
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

function addFileToList(file) {
  const item = document.createElement('div');
  item.className = 'file-item';

  const isEncrypted = file.name.endsWith('.scrypt');

  item.innerHTML = `
    <span class="name">${file.name}</span>
    <div class="actions">
      <button class="btn btn-primary" onclick="processFile(this, '${isEncrypted ? 'decrypt' : 'encrypt'}')">${isEncrypted ? 'Decrypt' : 'Encrypt'}</button>
    </div>
  `;

  item.dataset.file = JSON.stringify({ name: file.name, size: file.size });
  item._file = file;

  fileList.appendChild(item);
}

async function processFile(btn, action) {
  const item = btn.closest('.file-item');
  const file = item._file;

  btn.disabled = true;
  btn.textContent = 'Processing...';
  progressContainer.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = '0%';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', masterPassword);

  try {
    const eventSource = new EventSource('/api/progress');

    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.percentage !== undefined) {
        progressFill.style.width = `${data.percentage}%`;
        progressText.textContent = `${data.percentage}%`;
      }
    };

    const res = await fetch(`/api/${action}`, {
      method: 'POST',
      body: formData,
    });

    eventSource.close();

    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = action === 'encrypt' ? file.name + '.scrypt' : file.name.replace('.scrypt', '');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      addLog(`${action === 'encrypt' ? 'Encrypted' : 'Decrypted'}: ${file.name}`, 'success');
      progressFill.style.width = '100%';
      progressText.textContent = '100%';
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

function addLog(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  logEntries.prepend(entry);
}

checkVaultStatus();
