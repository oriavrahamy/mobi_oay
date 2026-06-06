/* ═══════════ TOOLS — Tool definitions and management ═══════════ */
const ToolManager = (() => {
  const TOOL_DEFS = [
    { id:'google_sheets', name:'Google Sheets', icon:'📊', color:'#0f9d58', category:'Google', wikiFile:'File:Google Sheets icon (2026).svg', scope:'https://www.googleapis.com/auth/spreadsheets' },
    { id:'google_calendar', name:'Google Calendar', icon:'📅', color:'#4285f4', category:'Google', wikiFile:'File:Google Calendar icon (2026).svg', scope:'https://www.googleapis.com/auth/calendar' },
    { id:'google_slides', name:'Google Slides', icon:'📽️', color:'#f4b400', category:'Google', wikiFile:'File:Google Slides icon (2026).svg', scope:'https://www.googleapis.com/auth/presentations' },
    { id:'google_forms', name:'Google Forms', icon:'📝', color:'#673ab7', category:'Google', wikiFile:'File:Google Forms icon (2026).svg', scope:'https://www.googleapis.com/auth/forms' },
    { id:'google_docs', name:'Google Docs', icon:'📄', color:'#4285f4', category:'Google', wikiFile:'File:Google Docs icon (2026).svg', scope:'https://www.googleapis.com/auth/documents' },
    { id:'google_meet', name:'Google Meet', icon:'📹', color:'#00897b', category:'Google', wikiFile:'File:Google Meet icon (2020).svg', scope:'https://www.googleapis.com/auth/calendar' },
    { id:'google_gmail', name:'Google Gmail', icon:'📧', color:'#ea4335', category:'Google', wikiFile:'File:Gmail icon (2026).svg', scope:'https://www.googleapis.com/auth/gmail.modify' },
    { id:'google_tasks', name:'Google Tasks', icon:'✅', color:'#4285f4', category:'Google', wikiFile:'File:Google Tasks Logo 05.2026.svg', scope:'https://www.googleapis.com/auth/tasks' },
    { id:'youtube_data', name:'YouTube Data', icon:'▶️', color:'#ff0000', category:'Google', wikiFile:'File:YouTube full-color icon (2017).svg', scope:'https://www.googleapis.com/auth/youtube.readonly' },
    { id:'google_fit', name:'Google Fit', icon:'💪', color:'#0f9d58', category:'Google', wikiFile:'File:Google Fit icon (2018).svg', scope:'https://www.googleapis.com/auth/fitness.activity.read' },
    { id:'notion', name:'Notion', icon:'📓', color:'#000000', category:'Productivity', wikiFile:'File:Notion-logo.svg' },
    {
      id:'home_assistant', name:'Home Assistant', icon:'🏠', color:'#41bdf5', category:'Smart Home',
      wikiFile:'File:Home Assistant logo (2023).svg',
      description:'Control smart-home entities through the Home Assistant REST API.',
      credentialLabels:{ apiKey:'Long-Lived Access Token', clientId:'Home Assistant Base URL', clientSecret:'Optional Area / Context', token:'Optional Webhook Token' },
      placeholders:{ apiKey:'eyJ0eXAiOiJKV1Qi...', clientId:'http://homeassistant.local:8123', clientSecret:'living_room', token:'Optional webhook token' }
    },
    {
      id:'notebooklm', name:'NotebookLM', icon:'📚', color:'#1a73e8', category:'Research',
      description:'NotebookLM automation via teng-lin/notebooklm-py CLI or a local bridge endpoint.',
      repo:'https://github.com/teng-lin/notebooklm-py',
      credentialLabels:{ apiKey:'Local Bridge URL', clientId:'CLI Command', clientSecret:'Profile Name', token:'Auth JSON / Storage State Path' },
      placeholders:{ apiKey:'http://localhost:8787/notebooklm', clientId:'notebooklm', clientSecret:'default', token:'~/.config/notebooklm/storage_state.json' }
    },
    { id:'google_maps', name:'Google Maps', icon:'🗺️', color:'#34a853', category:'Google', wikiFile:'File:Google Maps icon (2026).svg', scope:'https://www.googleapis.com/auth/userinfo.profile' },
    { id:'spotify', name:'Spotify', icon:'🎵', color:'#1db954', category:'Entertainment', wikiFile:'File:Spotify icon.svg' },
    { id:'google_classroom', name:'Google Classroom', icon:'🎓', color:'#0f9d58', category:'Google', wikiFile:'File:Google Classroom Logo.svg', scope:'https://www.googleapis.com/auth/classroom.courses' },
    { id:'wolfram_alpha', name:'WolframAlpha', icon:'🔢', color:'#dd1100', category:'Science', wikiFile:'File:Wolfram Alpha 2022.svg' },
  ];

  let toolStates = {}; // { toolId: { connected, credentials } }
  let logoUrls = {};

  async function loadLogos() {
    try {
      const cached = localStorage.getItem('mobi-tool-logos');
      if (cached) logoUrls = JSON.parse(cached);
    } catch (e) {}

    const missing = TOOL_DEFS.filter(d => !logoUrls[d.id] && d.wikiFile);
    if (missing.length === 0) return;

    try {
      const titles = missing.map(d => d.wikiFile).join('|');
      const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url&format=json&origin=*&formatversion=2`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const pages = data.query?.pages || [];
        pages.forEach(p => {
          const def = TOOL_DEFS.find(d => d.wikiFile === p.title);
          if (def && p.imageinfo?.[0]?.url) {
            logoUrls[def.id] = p.imageinfo[0].url;
          }
        });
        localStorage.setItem('mobi-tool-logos', JSON.stringify(logoUrls));
      }
    } catch (e) {
      console.error('Failed to load tool logos from Wikipedia:', e);
    }
  }

  async function init() {
    const saved = await Store.getTools();
    saved.forEach(t => { toolStates[t.id] = t; });
    // Ensure all tools exist in state
    TOOL_DEFS.forEach(d => {
      if (!toolStates[d.id]) toolStates[d.id] = { id: d.id, connected: false, credentials: {} };
    });
    await loadLogos();
  }

  function getDefs() { return TOOL_DEFS; }
  function getState(id) { return toolStates[id] || { id, connected: false, credentials: {} }; }
  function isConnected(id) { return toolStates[id]?.connected || false; }
  function getConnectedTools() { return TOOL_DEFS.filter(d => isConnected(d.id)); }
  function getLogoUrl(id) { return logoUrls[id] || null; }

  async function connect(id, credentials) {
    toolStates[id] = { id, connected: true, credentials };
    await Store.saveTool(toolStates[id]);
    MemoryManager.addLog('tool', `Tool "${getDefById(id).name}" connected`);
  }

  async function disconnect(id) {
    toolStates[id] = { id, connected: false, credentials: {} };
    await Store.saveTool(toolStates[id]);
    // Update all agents that had this tool
    const agents = AgentManager.getAll();
    agents.forEach(a => {
      if (a.tools && a.tools.includes(id)) {
        a.tools = a.tools.filter(t => t !== id);
        AgentManager.save(a);
      }
    });
    MemoryManager.addLog('tool', `Tool "${getDefById(id).name}" disconnected — removed from all agents`);
  }

  function getDefById(id) { return TOOL_DEFS.find(d => d.id === id) || { name: id }; }

  function renderToolsPanel() {
    const grid = document.getElementById('tools-grid');
    grid.innerHTML = '';
    TOOL_DEFS.forEach(def => {
      const state = getState(def.id);
      const card = document.createElement('div');
      card.className = 'tool-card' + (state.connected ? ' connected' : '');
      const logoUrl = getLogoUrl(def.id);
      const logoHtml = logoUrl
        ? `<img src="${logoUrl}" alt="${def.name}" class="tool-logo-img">`
        : `<div class="tool-logo-fallback" style="color:${def.color}">${def.icon}</div>`;
      card.innerHTML = `
        <div class="tool-logo" style="background:${def.color}15">${logoHtml}</div>
        <div class="tool-info">
          <h4>${def.name}</h4>
          <p>${def.description || def.category}</p>
          <div class="tool-status ${state.connected ? 'connected' : 'disconnected'}">
            <span class="status-dot"></span> ${state.connected ? 'Connected' : 'Not connected'}
          </div>
        </div>
        <button class="tool-connect-btn" data-tool="${def.id}">
          ${state.connected ? 'Manage' : 'Connect'}
        </button>
      `;
      grid.appendChild(card);
    });
  }

  function renderToolsDataPanel() {
    const container = document.getElementById('tools-data-container');
    if (!container) return;
    
    const connected = getConnectedTools();
    if (connected.length === 0) {
      container.innerHTML = `
        <div class="memory-empty">
          <span class="material-icons-round">info</span>
          <p>Connect tools to view their data here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    connected.forEach(def => {
      const state = getState(def.id);
      const section = document.createElement('div');
      section.className = 'data-tool-section';
      
      const logoUrl = getLogoUrl(def.id);
      const logoHtml = logoUrl
        ? `<img src="${logoUrl}" alt="${def.name}" class="tool-logo-img">`
        : `<span style="color:${def.color}">${def.icon}</span>`;
        
      // Generate some mock data based on the tool
      let mockData = `Connected to ${def.name}. Fetching recent data...\\n`;
      if (def.id.includes('gmail')) mockData += `\\n- Inbox: 3 Unread Messages\\n- Last email from 'boss@company.com': "Project Update"`;
      else if (def.id.includes('calendar')) mockData += `\\n- Today 14:00: Team Sync\\n- Tomorrow 10:00: Product Review`;
      else if (def.id.includes('sheets')) mockData += `\\n- Spreadsheet "Q3 Financials" updated 2 hrs ago\\n- Cell A1: "Revenue"`;
      else mockData += `\\nNo recent activity found.`;

      section.innerHTML = `
        <div class="data-tool-header">
          ${logoHtml} <span>${def.name} Data Sync</span>
        </div>
        <div class="data-tool-content">${mockData}</div>
      `;
      container.appendChild(section);
    });
  }

  return { init, getDefs, getState, isConnected, getConnectedTools, connect, disconnect, getDefById, renderToolsPanel, renderToolsDataPanel, getLogoUrl };
})();
