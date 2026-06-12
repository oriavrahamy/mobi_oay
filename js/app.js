/* ═══════════ APP — Main initialization & UI event handling ═══════════ */

// ── Google OAuth popup receiver (inside the popup itself) ──
if (window.opener && window.location.hash.includes('access_token')) {
  window.opener.postMessage({
    type: 'oauth-success',
    hash: window.location.hash
  }, window.location.origin);
  window.close();
} else if (window.location.search.includes('mock-oauth=true')) {
  // Render simulated Google Account Chooser
  const params = new URLSearchParams(window.location.search);
  const toolId = params.get('tool');
  document.documentElement.setAttribute('data-theme', 'light');
  document.title = 'Sign in with Google';
  
  document.body.innerHTML = `
    <style>
      body {
        margin: 0;
        font-family: 'Roboto', 'Inter', sans-serif;
        background-color: #f0f2f5;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
      }
      .card {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        width: 380px;
        padding: 40px 30px;
        text-align: center;
        border: 1px solid #dadce0;
      }
      .logo {
        height: 32px;
        margin-bottom: 16px;
      }
      h1 {
        font-size: 24px;
        font-weight: 400;
        margin: 0 0 8px 0;
        color: #202124;
      }
      p {
        font-size: 16px;
        color: #5f6368;
        margin: 0 0 24px 0;
      }
      .account-list {
        text-align: left;
        border-top: 1px solid #dadce0;
        margin-bottom: 24px;
      }
      .account-row {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #dadce0;
        cursor: pointer;
        transition: background 0.15s;
      }
      .account-row:hover {
        background-color: #f8f9fa;
      }
      .avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 500;
        margin-right: 12px;
      }
      .details {
        display: flex;
        flex-direction: column;
      }
      .name {
        font-size: 14px;
        font-weight: 500;
        color: #3c4043;
      }
      .email {
        font-size: 12px;
        color: #5f6368;
      }
      .footer {
        font-size: 12px;
        color: #5f6368;
        line-height: 1.4;
      }
      .footer a {
        color: #1a73e8;
        text-decoration: none;
      }
    </style>
    <div class="card">
      <svg class="logo" viewBox="0 0 24 24" style="width: 32px; height: 32px;">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      <h1>Choose an account</h1>
      <p>to continue to Mobi O.A.Y</p>
      <div class="account-list">
        <div class="account-row" data-email="personal-helper@gmail.com" data-name="Personal Assistant">
          <div class="avatar" style="background-color: #34a853;">P</div>
          <div class="details">
            <span class="name">Personal Assistant</span>
            <span class="email">personal-helper@gmail.com</span>
          </div>
        </div>
        <div class="account-row" data-email="work-admin@gmail.com" data-name="Work Administrator">
          <div class="avatar" style="background-color: #4285f4;">W</div>
          <div class="details">
            <span class="name">Work Administrator</span>
            <span class="email">work-admin@gmail.com</span>
          </div>
        </div>
        <div class="account-row" data-email="collab-partner@gmail.com" data-name="Collaboration Partner">
          <div class="avatar" style="background-color: #673ab7;">C</div>
          <div class="details">
            <span class="name">Collaboration Partner</span>
            <span class="email">collab-partner@gmail.com</span>
          </div>
        </div>
      </div>
      <div class="footer">
        To continue, Google will share your name, email address, and profile picture with Mobi O.A.Y. See their <a href="#">Privacy Policy</a> and <a href="#">Terms of Service</a>.
      </div>
    </div>
    <script>
      document.querySelectorAll('.account-row').forEach(row => {
        row.addEventListener('click', () => {
          const email = row.dataset.email;
          const mockToken = 'mock_token_' + email.replace('@', '_') + '_' + '${toolId}';
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth-success',
              hash: '#access_token=' + mockToken + '&state=' + '${toolId}'
            }, window.location.origin);
            window.close();
          }
        });
      });
    </script>
  `;
} else {
  (async function App() {
    'use strict';

  // ── Init all modules ──
  await Store.init();
  await ToolManager.init();
  await MemoryManager.init();
  Canvas.init();
  await AgentManager.init();
  AgentManager.loadAllToCanvas();
  ToolManager.renderToolsPanel();
  MemoryManager.renderMemoryPanel();

  // ── Theme toggler ──
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  function updateThemeUI(theme) {
    const icon = themeToggleBtn.querySelector('.material-icons-round');
    if (theme === 'light') {
      icon.textContent = 'dark_mode';
    } else {
      icon.textContent = 'light_mode';
    }
  }
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  updateThemeUI(currentTheme);

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('mobi-theme', next);
    updateThemeUI(next);
  });

  // ── Tab switching ──
  const tabs = document.querySelectorAll('.tab');
  const tabPanels = {
    tools: document.getElementById('tools-panel'),
    notebooklm: document.getElementById('notebooklm-panel'),
    memory: document.getElementById('memory-panel')
  };
  const canvasContainer = document.getElementById('canvas-container');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const id = tab.dataset.tab;
      Object.values(tabPanels).forEach(p => p.classList.remove('active'));
      
      // Hide canvas when switching to non-agents tabs
      if (id === 'agents') {
        canvasContainer.style.display = 'block';
      } else {
        canvasContainer.style.display = 'none';
      }
      
      if (tabPanels[id]) {
        tabPanels[id].classList.add('active');
        if (id === 'tools') {
          ToolManager.renderToolsPanel();
          ToolManager.renderToolsDataPanel();
        }
        if (id === 'notebooklm') NotebookLMPanel.refreshNotebooks();
        if (id === 'memory') MemoryManager.renderMemoryPanel();
      }
    });
  });

  // ── Tools Sub-Tab switching ──
  const subTabs = document.querySelectorAll('.sub-tab');
  const subPanels = {
    integrations: document.getElementById('tools-integrations-panel'),
    data: document.getElementById('tools-data-panel')
  };

  subTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      subTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const id = tab.dataset.subtab;
      Object.values(subPanels).forEach(p => {
        if(p) p.classList.remove('active');
      });
      if (subPanels[id]) {
        subPanels[id].classList.add('active');
        if (id === 'data') {
          ToolManager.renderToolsDataPanel();
        }
      }
    });
  });


  const NotebookLMPanel = (() => {
    let loaded = false;
    let currentNotebooks = [];
    let currentSources = [];

    const bridgeInput = document.getElementById('notebooklm-bridge-url');
    const commandInput = document.getElementById('notebooklm-cli-command');
    const notebookSelect = document.getElementById('notebooklm-select');
    const statusEl = document.getElementById('notebooklm-status');
    const sourceListEl = document.getElementById('notebooklm-source-list');
    const chatEl = document.getElementById('notebooklm-chat');
    const promptEl = document.getElementById('notebooklm-prompt');

    const artifactDownloadTypes = {
      audio: ['mp3', 'mp4'],
      video: ['mp4'],
      'slide-deck': ['pdf', 'pptx'],
      infographic: ['png'],
      quiz: ['json', 'markdown', 'html'],
      flashcards: ['json', 'markdown', 'html'],
      report: ['markdown'],
      'data-table': ['csv'],
      'mind-map': ['json']
    };

    function syncFromToolSettings() {
      const state = ToolManager.getState('notebooklm');
      bridgeInput.value = state.credentials?.apiKey || localStorage.getItem('mobi-notebooklm-bridge-url') || bridgeInput.value;
      commandInput.value = state.credentials?.clientId || localStorage.getItem('mobi-notebooklm-cli-command') || commandInput.value;
    }

    function saveLocalSettings() {
      localStorage.setItem('mobi-notebooklm-bridge-url', bridgeInput.value.trim());
      localStorage.setItem('mobi-notebooklm-cli-command', commandInput.value.trim() || 'notebooklm');
    }

    async function callBridge(action, params = {}) {
      saveLocalSettings();
      const bridgeUrl = bridgeInput.value.trim() || 'http://localhost:8787/notebooklm';
      const cliCommand = commandInput.value.trim() || 'notebooklm';
      const response = await fetch(bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params: { ...params, cliCommand } })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || data.stderr || `NotebookLM bridge error ${response.status}`);
      }
      return data;
    }

    function parseCliJson(data) {
      if (data.data) return data.data;
      const text = data.stdout || '';
      if (!text.trim()) return null;
      try { return JSON.parse(text); } catch (e) { return text; }
    }

    function normalizeList(value, keys = []) {
      const data = parseCliJson(value);
      if (Array.isArray(data)) return data;
      for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key];
      }
      return Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : [];
    }

    function normalizeNotebooks(value) {
      return normalizeList(value, ['notebooks']).map((item, index) => {
        if (typeof item === 'string') return { id: item, title: item };
        const id = item.id || item.notebook_id || item.notebookId || item.url || item.title || String(index + 1);
        const title = item.title || item.name || item.display_name || id;
        return { id, title };
      });
    }

    function normalizeSources(value) {
      return normalizeList(value, ['sources']).map((item, index) => {
        if (typeof item === 'string') return { id: item, title: item, type: 'source' };
        const id = item.id || item.source_id || item.sourceId || item.url || item.title || String(index + 1);
        const title = item.title || item.name || item.display_name || item.url || id;
        const type = item.type || item.mime_type || item.kind || 'source';
        const status = item.status || item.state || '';
        return { id, title, type, status, raw: item };
      });
    }

    function selectedNotebookId() {
      return notebookSelect.value || '';
    }

    function selectedNotebookTitle() {
      const selectedOption = notebookSelect.options[notebookSelect.selectedIndex];
      return selectedOption ? selectedOption.textContent : '';
    }

    function renderSources(sources) {
      if (!sourceListEl) return;
      if (!selectedNotebookId()) {
        sourceListEl.innerHTML = '<div class="notebooklm-source-empty">בחר מחברת כדי לראות מקורות</div>';
        return;
      }
      if (!sources.length) {
        sourceListEl.innerHTML = '<div class="notebooklm-source-empty">אין מקורות במחברת הזאת</div>';
        return;
      }
      sourceListEl.innerHTML = sources.map(src => `
        <label class="notebooklm-source-item" data-source-id="${escapeHtml(src.id)}">
          <input type="checkbox" checked>
          <span>
            ${escapeHtml(src.title)}
            <small>${escapeHtml([src.type, src.status].filter(Boolean).join(' · '))}</small>
          </span>
          <span class="notebooklm-source-item-actions">
            <button class="notebooklm-mini-icon" data-source-action="refresh" title="רענון מקור"><span class="material-icons-round">sync</span></button>
            <button class="notebooklm-mini-icon" data-source-action="delete" title="מחיקת מקור"><span class="material-icons-round">delete</span></button>
          </span>
        </label>
      `).join('');
    }

    function appendMessage(role, content, html = false) {
      if (chatEl.querySelector('.notebooklm-empty')) chatEl.innerHTML = '';
      const sourceView = document.getElementById('notebooklm-source-view');
      if (sourceView) sourceView.style.display = 'none';
      const el = document.createElement('div');
      el.className = `notebooklm-message ${role}`;
      el.dir = 'auto';
      if (html) el.innerHTML = content || '';
      else if (role === 'assistant' && typeof marked !== 'undefined') el.innerHTML = marked.parse(content || '');
      else el.textContent = content || '';
      chatEl.appendChild(el);
      chatEl.scrollTop = chatEl.scrollHeight;
      return el;
    }

    function resultText(data) {
      const parsed = parseCliJson(data);
      if (typeof parsed === 'string') return parsed;
      if (parsed?.answer) return parsed.answer;
      if (parsed?.text) return parsed.text;
      if (parsed?.summary) return parsed.summary;
      if (parsed?.task_id) return `Started. Task ID: ${parsed.task_id}. Status: ${parsed.status || 'pending'}`;
      return data.stdout || JSON.stringify(parsed || data, null, 2);
    }

    async function refreshSources() {
      const notebookId = selectedNotebookId();
      if (!notebookId) {
        currentSources = [];
        renderSources(currentSources);
        return;
      }
      try {
        const data = await callBridge('source_list', { notebookId, noTruncate: true });
        currentSources = normalizeSources(data);
        renderSources(currentSources);
      } catch (err) {
        currentSources = [];
        sourceListEl.innerHTML = `<div class="notebooklm-source-empty">${escapeHtml(err.message)}</div>`;
      }
    }

    async function refreshNotebooks(force = false) {
      if (loaded && !force) return;
      syncFromToolSettings();
      statusEl.textContent = 'Loading notebooks...';
      notebookSelect.innerHTML = '<option value="">Loading notebooks...</option>';
      try {
        const data = await callBridge('list_notebooks');
        currentNotebooks = normalizeNotebooks(data);
        notebookSelect.innerHTML = currentNotebooks.length
          ? currentNotebooks.map(nb => `<option value="${escapeHtml(nb.id)}">${escapeHtml(nb.title)}</option>`).join('')
          : '<option value="">לא נמצאו מחברות</option>';
        updateDynamicTitle();
        await refreshSources();
        statusEl.textContent = currentNotebooks.length ? `${currentNotebooks.length} מחברות נטענו.` : 'NotebookLM לא החזיר מחברות.';
        loaded = true;
      } catch (err) {
        notebookSelect.innerHTML = '<option value="">ה-bridge לא זמין</option>';
        if (sourceListEl) sourceListEl.innerHTML = '<div class="notebooklm-source-empty">הפעל: python3 tools/notebooklm_bridge.py</div>';
        statusEl.textContent = err.message;
        appendMessage('system', 'Start the bridge with: python3 tools/notebooklm_bridge.py');
      }
    }

    function updateDynamicTitle() {
      const dynamicTitle = document.getElementById('notebooklm-dynamic-title');
      if (dynamicTitle) dynamicTitle.textContent = selectedNotebookTitle() || 'MOBI O.A.Y AGENT';
    }

    function requireNotebook(actionName = 'הפעולה') {
      const notebookId = selectedNotebookId();
      if (notebookId) return notebookId;
      appendMessage('system', `${actionName} דורשת מחברת נבחרת. לחץ על רענון או צור מחברת חדשה.`);
      return '';
    }

    async function createNotebook() {
      appendMessage('system', 'פותח יצירת מחברת חדשה...');
      const title = window.prompt('שם למחברת החדשה');
      if (!title) return;
      appendMessage('system', `יוצר מחברת: ${title}`);
      try {
        const data = await callBridge('create_notebook', { title, use: true });
        appendMessage('assistant', resultText(data));
        loaded = false;
        await refreshNotebooks(true);
      } catch (err) {
        appendMessage('system', err.message);
      }
    }

    async function renameNotebook() {
      const notebookId = requireNotebook('שינוי שם');
      if (!notebookId) return;
      const title = window.prompt('שם חדש למחברת', selectedNotebookTitle());
      if (!title) return;
      try {
        const data = await callBridge('rename_notebook', { notebookId, title });
        appendMessage('assistant', resultText(data));
        loaded = false;
        await refreshNotebooks(true);
      } catch (err) {
        appendMessage('system', err.message);
      }
    }

    async function deleteNotebook() {
      const notebookId = requireNotebook('מחיקה');
      if (!notebookId || !window.confirm(`למחוק את המחברת "${selectedNotebookTitle()}"?`)) return;
      try {
        const data = await callBridge('delete_notebook', { notebookId });
        appendMessage('assistant', resultText(data));
        loaded = false;
        await refreshNotebooks(true);
      } catch (err) {
        appendMessage('system', err.message);
      }
    }

    async function addSource() {
      const notebookId = requireNotebook('הוספת מקור');
      if (!notebookId) return;
      appendMessage('system', 'פותח הוספת מקור...');
      const kind = (window.prompt('סוג מקור: url / youtube / file / drive / text / research', 'url') || '').toLowerCase();
      if (!kind) return;
      try {
        let data;
        if (kind === 'text') {
          const title = window.prompt('כותרת למקור טקסט', 'Pasted text') || 'Pasted text';
          const text = window.prompt('הדבק טקסט להוספה למחברת');
          if (!text) return;
          data = await callBridge('source_add_text', { notebookId, title, text });
        } else if (kind === 'drive') {
          const fileId = window.prompt('Google Drive file ID');
          const title = window.prompt('כותרת להצגה');
          if (!fileId || !title) return;
          data = await callBridge('source_add_drive', { notebookId, fileId, title });
        } else if (kind === 'research') {
          const query = window.prompt('שאלת מחקר');
          const mode = window.prompt('מצב מחקר: fast / deep', 'fast') || 'fast';
          if (!query) return;
          data = await callBridge('source_add_research', { notebookId, query, mode, importAll: true });
        } else {
          const content = window.prompt('URL, YouTube link, או נתיב לקובץ מקומי');
          if (!content) return;
          data = await callBridge('source_add', { notebookId, content, type: kind });
        }
        appendMessage('assistant', resultText(data));
        await refreshSources();
      } catch (err) {
        appendMessage('system', err.message);
      }
    }

    async function ask() {
      const question = promptEl.value.trim();
      const notebookId = requireNotebook('צ׳אט');
      if (!question) {
        appendMessage('system', 'כתוב שאלה או בקשה לפני שליחה.');
        return;
      }
      if (!notebookId) return;
      promptEl.value = '';
      appendMessage('user', question);
      appendMessage('system', 'NotebookLM is thinking...');
      try {
        const persona = localStorage.getItem('mobi-notebooklm-persona') || '';
        const data = await callBridge('ask', { notebookId, question, persona });
        chatEl.lastElementChild?.remove();
        appendMessage('assistant', resultText(data));
      } catch (err) {
        chatEl.lastElementChild?.remove();
        appendMessage('system', err.message);
      }
    }

    function generationOptions(type) {
      const common = { language: 'he', wait: true };
      const prompt = promptEl.value.trim();
      
      switch (type) {
        case 'summary':
          return { action: 'summary', label: 'Summary', hebrew: 'סיכום כללי', extra: {} };
        case 'podcast':
          return { action: 'generate_audio', label: 'Audio overview', hebrew: 'סקירה קולית', extra: { ...common, format: 'deep-dive', length: 'default' } };
        case 'video':
          return { action: 'generate_video', label: 'Video overview', hebrew: 'סקירת וידאו', extra: { ...common, format: 'explainer', style: 'auto' } };
        case 'slides':
          return { action: 'generate_slide_deck', label: 'Slide deck', hebrew: 'מצגת', extra: { ...common, format: 'presenter', length: 'default' } };
        case 'report':
          return { action: 'generate_report', label: 'Report', hebrew: 'דוח / בריף', extra: { ...common, format: 'briefing-doc' } };
        case 'mind_map':
          return { action: 'generate_mind_map', label: 'Mind map', hebrew: 'מפת חשיבה', extra: {} };
        case 'quiz':
          return { action: 'generate_quiz', label: 'Quiz', hebrew: 'Quiz', extra: { quantity: 'standard', difficulty: 'medium' } };
        case 'flashcards':
          return { action: 'generate_flashcards', label: 'Flashcards', hebrew: 'Flashcards', extra: { quantity: 'standard', difficulty: 'medium' } };
        case 'infographic':
          return { action: 'generate_infographic', label: 'Infographic', hebrew: 'Infographic', extra: { ...common, orientation: 'portrait', detail: 'standard' } };
        case 'data_table':
          return { action: 'generate_data_table', label: 'Data table', hebrew: 'Data Table', extra: { ...common } };
        case 'artifacts':
          return { action: 'artifact_list', label: 'Artifacts', hebrew: 'Artifacts', extra: { noTruncate: true } };
        case 'share_status':
          return { action: 'share_status', label: 'Sharing', hebrew: 'שיתוף', extra: {} };
        case 'research': {
          const query = prompt || window.prompt('שאלת מחקר') || '';
          return { action: 'source_add_research', label: 'Research', hebrew: 'Research', extra: { query, mode: 'fast', importAll: true } };
        }
        default:
          return null;
      }
    }

    async function generate(type) {
      const notebookId = requireNotebook('יצירת תוכן');
      if (!notebookId) return;
      const prompt = promptEl.value.trim();
      const config = generationOptions(type);
      if (!config) return;
      if (config.action === 'source_add_research' && !config.extra.query) return;
      appendMessage('user', `${config.label}${prompt ? ': ' + prompt : ''}`);
      appendMessage('system', `Starting ${config.label.toLowerCase()}...`);
      try {
        const data = await callBridge(config.action, { notebookId, prompt, description: prompt, ...config.extra });
        chatEl.lastElementChild?.remove();
        const result = resultText(data);
        appendMessage('assistant', result);
        showInStudioViewer(config.hebrew, result, type);
        if (config.action === 'source_add_research') await refreshSources();
      } catch (err) {
        chatEl.lastElementChild?.remove();
        appendMessage('system', err.message);
      }
    }

    function showInStudioViewer(title, content, type = '') {
      const viewer = document.getElementById('notebooklm-studio-viewer');
      const viewerTitle = document.getElementById('notebooklm-studio-viewer-title');
      const viewerContent = document.getElementById('notebooklm-studio-viewer-content');
      if (!viewer || !viewerTitle || !viewerContent) return;
      viewerTitle.textContent = title;
      if (typeof marked !== 'undefined') viewerContent.innerHTML = marked.parse(content || '');
      else viewerContent.textContent = content || '';

      const key = {
        podcast: 'audio',
        slides: 'slide-deck'
      }[type] || type?.replace('_', '-');

      const downloadTypes = artifactDownloadTypes[key];
      if (downloadTypes) {
        const row = document.createElement('div');
        row.className = 'notebooklm-action-row';
        downloadTypes.forEach(format => {
          const btn = document.createElement('button');
          btn.className = 'notebooklm-action-chip';
          btn.textContent = `Download ${format.toUpperCase()}`;
          btn.addEventListener('click', () => downloadArtifact(key, format));
          row.appendChild(btn);
        });
        viewerContent.appendChild(row);
      }
      viewer.classList.add('active');
    }

    async function downloadArtifact(type, format) {
      const notebookId = requireNotebook('הורדה');
      if (!notebookId) return;
      appendMessage('system', `Downloading ${type} as ${format}...`);
      try {
        const data = await callBridge('download_artifact', { notebookId, type, format, latest: true });
        chatEl.lastElementChild?.remove();
        appendMessage('assistant', resultText(data));
      } catch (err) {
        chatEl.lastElementChild?.remove();
        appendMessage('system', err.message);
      }
    }

    document.getElementById('notebooklm-refresh-btn').addEventListener('click', () => refreshNotebooks(true));
    document.getElementById('notebooklm-add-source-btn')?.addEventListener('click', addSource);
    document.getElementById('notebooklm-create-btn')?.addEventListener('click', createNotebook);
    document.getElementById('notebooklm-rename-btn')?.addEventListener('click', renameNotebook);
    document.getElementById('notebooklm-delete-btn')?.addEventListener('click', deleteNotebook);
    document.getElementById('notebooklm-ask-btn').addEventListener('click', ask);
    document.querySelector('.notebooklm-add-note-btn')?.addEventListener('click', async () => {
      const persona = window.prompt('Custom persona לצ׳אט הזה', localStorage.getItem('mobi-notebooklm-persona') || '');
      if (persona !== null) {
        localStorage.setItem('mobi-notebooklm-persona', persona);
        appendMessage('system', 'Persona נשמרה לצ׳אט NotebookLM.');
      }
    });
    document.getElementById('notebooklm-studio-viewer-close')?.addEventListener('click', () => {
      const viewer = document.getElementById('notebooklm-studio-viewer');
      if (viewer) viewer.classList.remove('active');
    });

    sourceListEl?.addEventListener('click', async e => {
      const btn = e.target.closest('[data-source-action]');
      if (!btn) return;
      e.preventDefault();
      const sourceId = btn.closest('[data-source-id]')?.dataset.sourceId;
      if (!sourceId) return;
      try {
        const action = btn.dataset.sourceAction === 'delete' ? 'source_delete' : 'source_refresh';
        if (action === 'source_delete' && !window.confirm('למחוק את המקור הזה?')) return;
        const data = await callBridge(action, { notebookId: selectedNotebookId(), sourceId });
        appendMessage('assistant', resultText(data));
        await refreshSources();
      } catch (err) {
        appendMessage('system', err.message);
      }
    });

    notebookSelect.addEventListener('change', async () => {
      updateDynamicTitle();
      await callBridge('use', { notebookId: selectedNotebookId() }).catch(() => {});
      await refreshSources();
    });
    promptEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        ask();
      }
    });
    document.querySelectorAll('[data-notebook-action]').forEach(btn => {
      btn.addEventListener('click', () => generate(btn.dataset.notebookAction));
    });

    function escapeHtml(s) {
      const d = document.createElement('div');
      d.textContent = s || '';
      return d.innerHTML;
    }

    return { refreshNotebooks };
  })();

  function fillVariantSelect(id, count) {
    const el = document.getElementById(id);
    if (!el || el.options.length) return;
    for (let i = 1; i <= count; i++) {
      const value = 'variant' + String(i).padStart(2, '0');
      const option = document.createElement('option');
      option.value = value;
      option.textContent = 'Style ' + i;
      el.appendChild(option);
    }
  }

  fillVariantSelect('avatar-eyes', 26);
  fillVariantSelect('avatar-mouth', 30);

  // ── Create Agent FAB ──
  document.getElementById('create-agent-fab').addEventListener('click', openAgentModal);

  // ── Agent Modal ──
  let editingAgentId = null;

  function openAgentModal(agentId) {
    editingAgentId = typeof agentId === 'string' ? agentId : null;
    const agent = editingAgentId ? AgentManager.get(editingAgentId) : null;
    const overlay = document.getElementById('agent-modal-overlay');

    document.getElementById('agent-modal-title').textContent = agent ? 'Edit Agent' : 'Create New Agent';
    document.getElementById('save-agent-btn').innerHTML = agent
      ? '<span class="material-icons-round">check</span> Save Changes'
      : '<span class="material-icons-round">check</span> Create Agent';

    // Fill form
    document.getElementById('agent-name').value = agent?.name || '';
    document.getElementById('agent-model').value = agent?.model || 'gemini-2.5-flash';
    document.getElementById('agent-api-key').value = agent?.apiKey || '';
    document.getElementById('agent-system-prompt').value = agent?.systemPrompt || '';

    // Avatar
    const opts = agent?.avatarOpts || {};
    document.getElementById('avatar-seed').value = opts.seed || 'agent' + Date.now();
    document.getElementById('avatar-earrings').value = opts.earrings || '';
    document.getElementById('avatar-eyebrows').value = opts.eyebrows || 'variant01';
    document.getElementById('avatar-eyes').value = opts.eyes || 'variant01';
    document.getElementById('avatar-mouth').value = opts.mouth || 'variant01';
    document.getElementById('avatar-glasses').value = opts.glasses || '';
    document.getElementById('avatar-hair').value = opts.hair || 'short01';
    document.getElementById('avatar-hair-color').value = opts.hairColor || '#6a4e35';
    document.getElementById('avatar-skin-color').value = opts.skinColor || '#f2d3b1';
    document.getElementById('hair-color-hex').textContent = opts.hairColor || '#6a4e35';
    document.getElementById('skin-color-hex').textContent = opts.skinColor || '#f2d3b1';

    // Features checkboxes
    document.querySelectorAll('.avatar-feature').forEach(cb => {
      cb.checked = opts.features ? opts.features.includes(cb.value) : false;
    });

    // Tool permissions
    AgentManager.renderToolPermissions(agent?.tools || []);

    updateAvatarPreview();
    overlay.classList.add('active');
  }

  function getAvatarOpts() {
    const features = [];
    document.querySelectorAll('.avatar-feature:checked').forEach(cb => features.push(cb.value));
    return {
      seed: document.getElementById('avatar-seed').value,
      earrings: document.getElementById('avatar-earrings').value,
      eyebrows: document.getElementById('avatar-eyebrows').value,
      eyes: document.getElementById('avatar-eyes').value,
      mouth: document.getElementById('avatar-mouth').value,
      glasses: document.getElementById('avatar-glasses').value,
      hair: document.getElementById('avatar-hair').value,
      hairColor: document.getElementById('avatar-hair-color').value,
      skinColor: document.getElementById('avatar-skin-color').value,
      features,
    };
  }

  function updateAvatarPreview() {
    const opts = getAvatarOpts();
    const url = AgentManager.generateAvatarUrl(opts);
    document.getElementById('avatar-preview').src = url;
  }

  // Avatar live preview listeners
  ['avatar-seed', 'avatar-earrings', 'avatar-eyebrows', 'avatar-eyes', 'avatar-mouth', 'avatar-glasses', 'avatar-hair',
   'avatar-hair-color', 'avatar-skin-color'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', updateAvatarPreview);
    el.addEventListener('change', updateAvatarPreview);
  });
  document.querySelectorAll('.avatar-feature').forEach(cb => {
    cb.addEventListener('change', updateAvatarPreview);
  });

  // Color hex display
  document.getElementById('avatar-hair-color').addEventListener('input', e => {
    document.getElementById('hair-color-hex').textContent = e.target.value;
  });
  document.getElementById('avatar-skin-color').addEventListener('input', e => {
    document.getElementById('skin-color-hex').textContent = e.target.value;
  });

  // Save agent
  document.getElementById('save-agent-btn').addEventListener('click', async () => {
    const name = document.getElementById('agent-name').value.trim();
    if (!name) { showToast('Please enter an agent name', 'error'); return; }

    const avatarOpts = getAvatarOpts();
    const avatarUrl = AgentManager.generateAvatarUrl(avatarOpts);

    // Get selected tools
    const tools = [];
    document.querySelectorAll('.tool-perm-cb:checked').forEach(cb => tools.push(cb.value));

    const data = {
      name,
      model: document.getElementById('agent-model').value,
      apiKey: document.getElementById('agent-api-key').value,
      systemPrompt: document.getElementById('agent-system-prompt').value,
      avatarUrl, avatarOpts, tools,
    };

    if (editingAgentId) {
      const agent = AgentManager.get(editingAgentId);
      Object.assign(agent, data);
      await AgentManager.save(agent);
      // Update canvas avatar
      const el = Canvas.getAgentElement(editingAgentId);
      if (el) {
        el.querySelector('img').src = AgentManager.getAvatarUrlForEmotion(agent, agent.emotion || 'idle');
        el.querySelector('.agent-name-tag').textContent = name;
        Canvas.setAgentEmotion(editingAgentId, agent.emotion || 'idle');
      }
      showToast('Agent updated!', 'success');
    } else {
      await AgentManager.create(data);
      showToast('Agent created!', 'success');
    }

    closeModal('agent-modal-overlay');
  });

  // ── Canvas agent click → open chat ──
  Canvas.onAgentClick(agentId => {
    ChatManager.open(agentId);
  });

  Canvas.onBubbleClick(agentId => {
    ChatManager.showInterAgentChat(agentId);
  });

  // ── Chat panel ──
  document.getElementById('chat-close-btn').addEventListener('click', ChatManager.close);

  document.getElementById('chat-send-btn').addEventListener('click', () => {
    const input = document.getElementById('chat-input');
    ChatManager.sendMessage(input.value);
    input.value = '';
    input.style.height = 'auto';
  });

  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('chat-send-btn').click();
    }
  });

  // Auto-resize textarea
  document.getElementById('chat-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  // Chat settings (edit agent)
  document.getElementById('chat-settings-btn').addEventListener('click', () => {
    const id = ChatManager.getCurrentAgentId();
    if (id) { ChatManager.close(); openAgentModal(id); }
  });

  // Chat delete agent
  document.getElementById('chat-delete-btn').addEventListener('click', async () => {
    const id = ChatManager.getCurrentAgentId();
    if (!id) return;
    const agent = AgentManager.get(id);
    if (confirm(`Delete agent "${agent?.name}"? Memories will be preserved.`)) {
      ChatManager.close();
      await AgentManager.remove(id);
      showToast('Agent deleted', 'success');
    }
  });

  // ── Tool connection modal ──
  let currentToolId = null;

  document.getElementById('tools-grid').addEventListener('click', e => {
    const btn = e.target.closest('.tool-connect-btn');
    if (!btn) return;
    currentToolId = btn.dataset.tool;
    const def = ToolManager.getDefById(currentToolId);
    const state = ToolManager.getState(currentToolId);
    document.getElementById('tool-modal-title').textContent = `Connect ${def.name}`;

    // Show/hide Google login button section
    const googleLoginSection = document.getElementById('google-login-section');
    if (def.category === 'Google') {
      googleLoginSection.style.display = 'block';
    } else {
      googleLoginSection.style.display = 'none';
    }

    const labels = def.credentialLabels || {};
    const placeholders = def.placeholders || {};
    document.querySelector('label[for="tool-api-key"]').textContent = labels.apiKey || 'API Key';
    document.querySelector('label[for="tool-client-id"]').textContent = labels.clientId || 'OAuth Client ID (optional)';
    document.querySelector('label[for="tool-client-secret"]').textContent = labels.clientSecret || 'OAuth Client Secret (optional)';
    document.querySelector('label[for="tool-token"]').textContent = labels.token || 'OAuth Token (optional)';
    document.getElementById('tool-api-key').placeholder = placeholders.apiKey || 'Enter API Key';
    document.getElementById('tool-client-id').placeholder = placeholders.clientId || 'Client ID';
    document.getElementById('tool-client-secret').placeholder = placeholders.clientSecret || 'Client Secret';
    document.getElementById('tool-token').placeholder = placeholders.token || 'Access Token';

    // Fill existing credentials
    document.getElementById('tool-api-key').value = state.credentials?.apiKey || '';
    document.getElementById('tool-client-id').value = state.credentials?.clientId || '';
    document.getElementById('tool-client-secret').value = state.credentials?.clientSecret || '';
    document.getElementById('tool-token').value = state.credentials?.token || '';

    // Show disconnect button if connected
    document.getElementById('disconnect-tool-btn').style.display = state.connected ? 'inline-flex' : 'none';

    document.getElementById('tool-modal-overlay').classList.add('active');
  });

  document.getElementById('google-login-btn').addEventListener('click', () => {
    const clientId = document.getElementById('tool-client-id').value.trim();
    const def = ToolManager.getDefById(currentToolId);
    
    if (clientId) {
      // Real Google OAuth 2.0 Implicit Flow
      const scope = def.scope || 'https://www.googleapis.com/auth/userinfo.profile';
      const redirectUri = window.location.origin + window.location.pathname;
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&state=${currentToolId}`;
      window.open(oauthUrl, 'google-oauth', 'width=500,height=600');
    } else {
      // Simulated Mock Google Login
      const mockUrl = window.location.origin + window.location.pathname + `?mock-oauth=true&tool=${currentToolId}`;
      window.open(mockUrl, 'google-oauth', 'width=500,height=600');
    }
  });

  // Handle successful OAuth callback messages from popups
  window.addEventListener('message', async (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === 'oauth-success') {
      const hash = event.data.hash;
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const state = params.get('state'); // toolId
      if (accessToken && state) {
        const toolId = state;
        const def = ToolManager.getDefById(toolId);
        
        const creds = {
          apiKey: document.getElementById('tool-api-key').value.trim(),
          clientId: document.getElementById('tool-client-id').value.trim(),
          clientSecret: document.getElementById('tool-client-secret').value.trim(),
          token: accessToken
        };
        
        await ToolManager.connect(toolId, creds);
        
        if (currentToolId === toolId) {
          document.getElementById('tool-token').value = accessToken;
          document.getElementById('disconnect-tool-btn').style.display = 'inline-flex';
        }
        
        ToolManager.renderToolsPanel();
        showToast(`Connected to ${def.name} successfully!`, 'success');
      }
    }
  });

  document.getElementById('connect-tool-btn').addEventListener('click', async () => {
    const creds = {
      apiKey: document.getElementById('tool-api-key').value.trim(),
      clientId: document.getElementById('tool-client-id').value.trim(),
      clientSecret: document.getElementById('tool-client-secret').value.trim(),
      token: document.getElementById('tool-token').value.trim(),
    };
    if (!creds.apiKey && !creds.clientId && !creds.token) {
      showToast('Please provide connection details', 'error');
      return;
    }
    await ToolManager.connect(currentToolId, creds);
    closeModal('tool-modal-overlay');
    ToolManager.renderToolsPanel();
    showToast('Tool connected!', 'success');
  });

  document.getElementById('disconnect-tool-btn').addEventListener('click', async () => {
    await ToolManager.disconnect(currentToolId);
    closeModal('tool-modal-overlay');
    ToolManager.renderToolsPanel();
    showToast('Tool disconnected', 'success');
  });

  // ── Memory ──
  document.getElementById('clear-memory-btn').addEventListener('click', async () => {
    if (confirm('Clear all shared memory? This cannot be undone.')) {
      await MemoryManager.clearAll();
      showToast('Memory cleared', 'success');
    }
  });

  // ── Global Settings ──
  document.getElementById('global-settings-btn').addEventListener('click', () => {
    const key = localStorage.getItem('mobi-global-api-key') || '';
    document.getElementById('global-api-key').value = key;
    document.getElementById('global-settings-overlay').classList.add('active');
  });

  document.getElementById('save-global-settings-btn').addEventListener('click', () => {
    const key = document.getElementById('global-api-key').value.trim();
    localStorage.setItem('mobi-global-api-key', key);
    closeModal('global-settings-overlay');
    showToast('Global settings saved!', 'success');
  });

  // ── Modal close buttons ──
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  // Click overlay to close
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => {
      if (e.target === ov) ov.classList.remove('active');
    });
  });

  function closeModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  // ── Toast ──
  function showToast(msg, type = '') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
  }

  // ── Idle wander (subtle random movement for agents) ──
  setInterval(() => {
    AgentManager.getAll().forEach(agent => {
      const el = Canvas.getAgentElement(agent.id);
      if (!el || el.classList.contains('walking') || el.classList.contains('dragging')) return;
      // Small random drift
      const curX = parseFloat(el.style.left) || agent.x;
      const curY = parseFloat(el.style.top) || agent.y;
      const dx = (Math.random() - 0.5) * 20;
      const dy = (Math.random() - 0.5) * 20;
      el.style.transition = 'left 3s ease-in-out, top 3s ease-in-out';
      el.style.left = (curX + dx) + 'px';
      el.style.top = (curY + dy) + 'px';
      setTimeout(() => { el.style.transition = ''; }, 3100);
    });
  }, 5000);

  console.log('🤖 Mobi O.A.Y Agent Platform initialized');
  })();
}
