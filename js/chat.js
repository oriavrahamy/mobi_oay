/* ═══════════ CHAT — Chat panel & Gemini API ═══════════ */
const ChatManager = (() => {
  let currentAgentId = null;
  let isProcessing = false;

  function open(agentId) {
    const agent = AgentManager.get(agentId);
    if (!agent) return;
    currentAgentId = agentId;
    const panel = document.getElementById('chat-panel');
    document.getElementById('chat-avatar').src = AgentManager.getAvatarUrlForEmotion(agent, agent.emotion || 'idle');
    document.getElementById('chat-agent-name').textContent = agent.name;
    document.getElementById('chat-agent-role').textContent = agent.systemPrompt
      ? agent.systemPrompt.substring(0, 60) + (agent.systemPrompt.length > 60 ? '…' : '')
      : 'No role defined';
    renderMessages(agent);
    panel.classList.add('open');
    panel.classList.remove('closed');
    document.getElementById('chat-input').focus();
  }

  function close() {
    currentAgentId = null;
    const panel = document.getElementById('chat-panel');
    panel.classList.remove('open');
    panel.classList.add('closed');
  }

  function getCurrentAgentId() { return currentAgentId; }

  function renderMessages(agent) {
    const container = document.getElementById('chat-messages');
    if (!agent.chatHistory || agent.chatHistory.length === 0) {
      container.innerHTML = `<div class="chat-msg system">Start a conversation with ${agent.name}</div>`;
      return;
    }
    container.innerHTML = agent.chatHistory.map(m => {
      if (m.role === 'system') return `<div class="chat-msg system" dir="auto">${escapeHtml(m.content)}</div>`;
      return `<div class="chat-msg ${m.role}" dir="auto">${escapeHtml(m.content)}</div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  function addMessage(role, content) {
    const agent = AgentManager.get(currentAgentId);
    if (!agent) return;
    if (!agent.chatHistory) agent.chatHistory = [];
    agent.chatHistory.push({ role, content, timestamp: Date.now() });
    AgentManager.save(agent);
    renderMessages(agent);
  }

  function showTyping() {
    const container = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-msg agent';
    el.id = 'typing-indicator';
    el.innerHTML = `<div class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  async function sendMessage(text) {
    if (!text.trim() || !currentAgentId || isProcessing) return;
    const agent = AgentManager.get(currentAgentId);
    if (!agent) return;
    const globalKey = localStorage.getItem('mobi-global-api-key') || '';
    if (!agent.apiKey && !globalKey) {
      Canvas.setAgentEmotion(agent.id, 'confused', { resetAfter: 5000 });
      addMessage('system', '⚠️ No Gemini API key configured. Click the Settings gear in the header to add a Global API Key, or edit this agent to set one.');
      return;
    }
    isProcessing = true;
    Canvas.setAgentEmotion(agent.id, 'thinking');
    addMessage('user', text);
    MemoryManager.addLog('chat', `User → ${agent.name}: ${text}`, 'User');
    showTyping();

    try {
      const response = await CollaborationEngine.processTask(agent, text);
      hideTyping();
      addMessage('agent', response);
      MemoryManager.addLog('chat', `${agent.name} → User: ${response.substring(0, 200)}`, agent.name);
    } catch (err) {
      Canvas.setAgentEmotion(agent.id, 'sad', { resetAfter: 5000 });
      hideTyping();
      addMessage('system', `❌ Error: ${err.message}`);
    }
    isProcessing = false;
  }

  // Show inter-agent conversation
  function showInterAgentChat(agentId) {
    const agent = AgentManager.get(agentId);
    if (!agent || !agent._interChat || agent._interChat.length === 0) return;
    const overlay = document.getElementById('inter-chat-overlay');
    document.getElementById('inter-chat-title').textContent = `Conversation — ${agent.name}`;
    const container = document.getElementById('inter-chat-messages');
    container.innerHTML = agent._interChat.map(m => `
      <div class="inter-msg ${m.from === agent.id ? 'from-a' : 'from-b'}" dir="auto">
        <div class="inter-sender">${m.fromName}</div>
        <div>${escapeHtml(m.text)}</div>
      </div>
    `).join('');
    overlay.classList.add('active');
  }

  function requestToolApproval(toolName, targetFile, actionDesc) {
    return new Promise((resolve, reject) => {
      const container = document.getElementById('chat-messages');
      const el = document.createElement('div');
      el.className = 'chat-msg system tool-approval-msg';
      
      // Inline styles for simplicity, or we can use existing button classes
      el.innerHTML = `
        <div style="font-weight:bold; color:#d97706; margin-bottom:8px;">⚠️ Agent requests permission</div>
        <div style="font-size:0.9rem; margin-bottom:12px; background:var(--bg2); padding:8px; border-radius:4px;">
          <div><strong>Target:</strong> ${toolName}</div>
          <div><strong>File:</strong> ${targetFile || 'N/A'}</div>
          <div><strong>Action:</strong> ${actionDesc}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-approve" style="flex:1; justify-content:center; padding:6px;">Confirm Execution</button>
          <button class="btn btn-ghost btn-reject" style="flex:1; justify-content:center; padding:6px;">Reject/Cancel</button>
        </div>
      `;
      container.appendChild(el);
      container.scrollTop = container.scrollHeight;

      const approveBtn = el.querySelector('.btn-approve');
      const rejectBtn = el.querySelector('.btn-reject');

      approveBtn.addEventListener('click', () => {
        el.innerHTML = `<div style="font-weight:bold; color:var(--success);">✅ Execution Confirmed</div>`;
        resolve(true);
      });

      rejectBtn.addEventListener('click', () => {
        el.innerHTML = `<div style="font-weight:bold; color:var(--error);">❌ Execution Rejected</div>`;
        reject(new Error('User rejected tool execution'));
      });
    });
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  return { open, close, getCurrentAgentId, addMessage, sendMessage, showInterAgentChat, renderMessages, requestToolApproval };
})();
