/* ═══════════ CANVAS — Infinite pan/zoom canvas ═══════════ */
const Canvas = (() => {
  let container, canvasEl;
  let panX = 0, panY = 0, zoom = 1;
  let isPanning = false, startX = 0, startY = 0;
  let dragAgent = null, dragOffsetX = 0, dragOffsetY = 0;
  let onAgentClickCb = null;
  let onBubbleClickCb = null;
  let onAgentSettingsClickCb = null;
  const emotionResetTimers = {};

  // Canvas interaction modes
  let currentMode = 'select'; // 'select' | 'drag' | 'settings'
  const MODE_SELECT = 'select';
  const MODE_DRAG = 'drag';
  const MODE_SETTINGS = 'settings';

  function init() {
    container = document.getElementById('canvas-container');
    canvasEl = document.getElementById('canvas');

    // Add SVG for connection lines
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'connection-svg';
    canvasEl.appendChild(svg);

    // Center canvas
    panX = window.innerWidth / 2 - 400;
    panY = (window.innerHeight - 58) / 2 - 300;
    updateTransform();

    // Pan
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointerleave', onPointerUp);

    // Zoom
    container.addEventListener('wheel', onWheel, { passive: false });

    // Zoom controls
    document.getElementById('zoom-in').addEventListener('click', () => setZoom(zoom + 0.1));
    document.getElementById('zoom-out').addEventListener('click', () => setZoom(zoom - 0.1));
    document.getElementById('zoom-reset').addEventListener('click', () => {
      zoom = 1; panX = window.innerWidth / 2 - 400; panY = (window.innerHeight - 58) / 2 - 300;
      updateTransform();
    });

    // Initialize toolbar
    initToolbar();

    // Load saved mode preference
    const savedMode = localStorage.getItem('canvas-mode') || MODE_SELECT;
    setMode(savedMode);
  }

  // ── Toolbar Functions ──
  function initToolbar() {
    const toolbar = document.getElementById('canvas-toolbar');
    if (!toolbar) return;

    const buttons = toolbar.querySelectorAll('.toolbar-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = btn.dataset.mode;
        setMode(mode);
        e.stopPropagation();
      });
    });
  }

  function setMode(mode) {
    if (![MODE_SELECT, MODE_DRAG, MODE_SETTINGS].includes(mode)) return;
    
    currentMode = mode;
    localStorage.setItem('canvas-mode', mode);
    updateToolbarUI();
    updateCanvasCursor();
  }

  function getMode() {
    return currentMode;
  }

  function updateToolbarUI() {
    const toolbar = document.getElementById('canvas-toolbar');
    if (!toolbar) return;

    const buttons = toolbar.querySelectorAll('.toolbar-btn');
    buttons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.mode === currentMode) {
        btn.classList.add('active');
      }
    });
  }

  function updateCanvasCursor() {
    switch (currentMode) {
      case MODE_DRAG:
        container.style.cursor = 'grab';
        break;
      case MODE_SELECT:
        container.style.cursor = 'default';
        break;
      case MODE_SETTINGS:
        container.style.cursor = 'help';
        break;
      default:
        container.style.cursor = 'default';
    }
  }

  function onPointerDown(e) {
    // Check if clicking on an agent
    const agentEl = e.target.closest('.canvas-agent');
    if (agentEl) {
      // Check if it's a bubble click
      if (e.target.closest('.speech-bubble')) {
        if (onBubbleClickCb) onBubbleClickCb(agentEl.dataset.agentId);
        return;
      }

      const agentId = agentEl.dataset.agentId;

      // Settings mode: open settings modal
      if (currentMode === MODE_SETTINGS) {
        if (onAgentSettingsClickCb) onAgentSettingsClickCb(agentId);
        return;
      }

      // Select/Drag mode: prepare for potential drag
      if (currentMode === MODE_SELECT) {
        const rect = agentEl.getBoundingClientRect();
        dragAgent = agentEl;
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        dragAgent._clickStart = Date.now();
        dragAgent._clickX = e.clientX;
        dragAgent._clickY = e.clientY;
        e.preventDefault();
        return;
      }

      // In drag mode, agents are unclickable
      return;
    }

    // Handle canvas panning based on mode
    if (currentMode === MODE_DRAG) {
      isPanning = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      container.style.cursor = 'grabbing';
    }
  }

  function onPointerMove(e) {
    if (dragAgent) {
      const dx = Math.abs(e.clientX - dragAgent._clickX);
      const dy = Math.abs(e.clientY - dragAgent._clickY);
      if (dx > 5 || dy > 5) {
        dragAgent.classList.add('dragging');
        const canvasRect = canvasEl.getBoundingClientRect();
        const x = (e.clientX - canvasRect.left) / zoom - 32;
        const y = (e.clientY - canvasRect.top) / zoom - 32;
        dragAgent.style.left = x + 'px';
        dragAgent.style.top = y + 'px';
        // Update agent data
        const id = dragAgent.dataset.agentId;
        const agent = AgentManager.get(id);
        if (agent) { agent.x = x; agent.y = y; }
      }
      return;
    }
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateTransform();
  }

  function onPointerUp(e) {
    if (dragAgent) {
      const dx = Math.abs(e.clientX - (dragAgent._clickX || 0));
      const dy = Math.abs(e.clientY - (dragAgent._clickY || 0));
      const wasDrag = dx > 5 || dy > 5;
      dragAgent.classList.remove('dragging');
      if (wasDrag) {
        // Save position
        const id = dragAgent.dataset.agentId;
        const agent = AgentManager.get(id);
        if (agent) AgentManager.save(agent);
      } else {
        // It was a click
        if (onAgentClickCb) onAgentClickCb(dragAgent.dataset.agentId);
      }
      dragAgent = null;
      return;
    }
    isPanning = false;
    container.style.cursor = 'grab';
  }

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(zoom + delta);
  }

  function setZoom(z) {
    zoom = Math.max(0.2, Math.min(3, z));
    updateTransform();
  }

  function updateTransform() {
    canvasEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    document.getElementById('zoom-level').textContent = Math.round(zoom * 100) + '%';
  }

  function addAgentToCanvas(agent) {
    const wrap = document.getElementById('canvas-agents');
    const el = document.createElement('div');
    el.className = 'canvas-agent';
    el.dataset.agentId = agent.id;
    el.dataset.emotion = agent.emotion || 'idle';
    el.style.left = (agent.x || 200 + Math.random() * 600) + 'px';
    el.style.top = (agent.y || 200 + Math.random() * 400) + 'px';
    // Add random animation delay for natural feel
    el.style.animationDelay = (Math.random() * 2).toFixed(1) + 's';
    el.innerHTML = `
      <div class="agent-avatar-wrap">
        <img src="${AgentManager.getAvatarUrlForEmotion(agent, agent.emotion || 'idle')}" alt="${agent.name}">
      </div>
      <span class="agent-name-tag">${agent.name}</span>
    `;
    wrap.appendChild(el);
  }

  function removeAgentFromCanvas(id) {
    const el = document.querySelector(`.canvas-agent[data-agent-id="${id}"]`);
    if (el) el.remove();
  }

  function setAgentEmotion(agentId, emotion = 'idle', options = {}) {
    const agent = AgentManager.get(agentId);
    const normalized = emotion || 'idle';
    if (agent) agent.emotion = normalized;

    const nextUrl = agent ? AgentManager.getAvatarUrlForEmotion(agent, normalized) : '';
    const el = getAgentElement(agentId);
    if (el) {
      el.dataset.emotion = normalized;
      const img = el.querySelector('img');
      if (img && nextUrl) img.src = nextUrl;
    }

    if (typeof ChatManager !== 'undefined' && ChatManager.getCurrentAgentId?.() === agentId) {
      const chatAvatar = document.getElementById('chat-avatar');
      if (chatAvatar && nextUrl) chatAvatar.src = nextUrl;
    }

    clearTimeout(emotionResetTimers[agentId]);
    if (options.resetAfter) {
      emotionResetTimers[agentId] = setTimeout(() => {
        setAgentEmotion(agentId, options.resetTo || 'idle');
      }, options.resetAfter);
    }
  }

  function getAgentElement(id) {
    return document.querySelector(`.canvas-agent[data-agent-id="${id}"]`);
  }

  function showBubble(agentId, text) {
    const el = getAgentElement(agentId);
    if (!el) return;
    let bubble = el.querySelector('.speech-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'speech-bubble';
      el.appendChild(bubble);
    }
    bubble.textContent = text.length > 40 ? text.substring(0, 40) + '…' : text;
  }

  function hideBubble(agentId) {
    const el = getAgentElement(agentId);
    if (!el) return;
    const bubble = el.querySelector('.speech-bubble');
    if (bubble) bubble.remove();
  }

  function showQuestionMark(agentId) {
    const el = getAgentElement(agentId);
    if (!el) return;
    if (el.querySelector('.question-indicator')) return;
    const q = document.createElement('div');
    q.className = 'question-indicator';
    q.textContent = '?';
    el.appendChild(q);
  }

  function hideQuestionMark(agentId) {
    const el = getAgentElement(agentId);
    if (!el) return;
    const q = el.querySelector('.question-indicator');
    if (q) q.remove();
  }

  function moveAgentTo(agentId, targetX, targetY) {
    return new Promise(resolve => {
      const el = getAgentElement(agentId);
      if (!el) { resolve(); return; }
      el.classList.add('walking');
      el.style.left = targetX + 'px';
      el.style.top = targetY + 'px';
      // Update data
      const agent = AgentManager.get(agentId);
      if (agent) { agent.x = targetX; agent.y = targetY; }
      setTimeout(() => {
        el.classList.remove('walking');
        resolve();
      }, 1600);
    });
  }

  function getAgentPos(agentId) {
    const el = getAgentElement(agentId);
    if (!el) return { x: 0, y: 0 };
    return { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 };
  }

  function drawConnectionLine(fromId, toId) {
    const svg = document.getElementById('connection-svg');
    const p1 = getAgentPos(fromId);
    const p2 = getAgentPos(toId);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.x + 32);
    line.setAttribute('y1', p1.y + 32);
    line.setAttribute('x2', p2.x + 32);
    line.setAttribute('y2', p2.y + 32);
    line.classList.add('agent-connection-line');
    line.id = `conn-${fromId}-${toId}`;
    svg.appendChild(line);
  }

  function removeConnectionLine(fromId, toId) {
    const line = document.getElementById(`conn-${fromId}-${toId}`);
    if (line) line.remove();
  }

  function clearAllConnections() {
    const svg = document.getElementById('connection-svg');
    if (svg) svg.innerHTML = '';
  }

  function onAgentClick(cb) { onAgentClickCb = cb; }
  function onBubbleClick(cb) { onBubbleClickCb = cb; }
  function onAgentSettingsClick(cb) { onAgentSettingsClickCb = cb; }

  return {
    init, addAgentToCanvas, removeAgentFromCanvas, getAgentElement,
    setAgentEmotion,
    showBubble, hideBubble, showQuestionMark, hideQuestionMark,
    moveAgentTo, getAgentPos, drawConnectionLine, removeConnectionLine,
    clearAllConnections, onAgentClick, onBubbleClick, onAgentSettingsClick,
    setMode, getMode
  };
})();
