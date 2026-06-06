/* ═══════════ MEMORY — Shared memory pool ═══════════ */
const MemoryManager = (() => {
  let logs = [];

  async function init() {
    logs = await Store.getMemory();
    logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  async function addLog(type, content, agentName) {
    const entry = {
      type, // 'task','chat','collaboration','tool','system'
      content,
      agentName: agentName || 'System',
      timestamp: Date.now()
    };
    logs.unshift(entry);
    await Store.addMemory(entry);
    renderMemoryPanel();
  }

  function getLogs() { return logs; }

  function getRecentContext(limit = 20) {
    return logs.slice(0, limit).map(l =>
      `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.agentName}: ${l.content}`
    ).join('\n');
  }

  async function clearAll() {
    logs = [];
    await Store.clearMemory();
    renderMemoryPanel();
  }

  function renderMemoryPanel() {
    const container = document.getElementById('memory-log');
    if (logs.length === 0) {
      container.innerHTML = `<div class="memory-empty">
        <span class="material-icons-round">cloud_off</span>
        <p>No memories recorded yet.<br>Start a conversation with an agent to begin.</p>
      </div>`;
      return;
    }
    const icons = { task: '🎯', chat: '💬', collaboration: '🤝', tool: '🔧', system: '⚙️' };
    container.innerHTML = logs.slice(0, 200).map(l => `
      <div class="memory-entry">
        <span class="mem-time">${new Date(l.timestamp).toLocaleTimeString()}</span>
        <span class="mem-icon">${icons[l.type] || '📌'}</span>
        <div class="mem-content"><strong>${l.agentName}</strong> — ${escapeHtml(l.content)}</div>
      </div>
    `).join('');
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  return { init, addLog, getLogs, getRecentContext, clearAll, renderMemoryPanel };
})();
