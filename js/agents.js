/* ═══════════ AGENTS — Agent management & Dicebear avatars ═══════════ */
const AgentManager = (() => {
  let agents = {}; // { id: agentData }

  const EMOTION_AVATAR_PARTS = {
    idle: {},
    thinking: { eyes: 'variant12', mouth: 'variant15' },
    focused: { eyes: 'variant14', mouth: 'variant05' },
    speaking: { eyes: 'variant01', mouth: 'variant24' },
    happy: { eyes: 'variant26', mouth: 'variant30' },
    confused: { eyes: 'variant18', mouth: 'variant11' },
    sad: { eyes: 'variant09', mouth: 'variant07' },
    surprised: { eyes: 'variant16', mouth: 'variant26' },
  };

  async function init() {
    const saved = await Store.getAgents();
    const migrationKey = 'mobi-model-migration-v1-5-to-2-5';
    let shouldRunMigration = true;
    try {
      shouldRunMigration = !localStorage.getItem(migrationKey);
    } catch (e) {
      // If localStorage isn't available for some reason, don't break app startup.
      shouldRunMigration = true;
    }

    for (const a of saved) {
      let changed = false;
      if (shouldRunMigration) {
        if (a.model && a.model.startsWith('gemini')) {
          a.model = 'llama-3.1-8b-instant';
          changed = true;
        }
      }
      agents[a.id] = a;
      if (changed) {
        await Store.saveAgent(a);
      }
    }

    // Ensure legacy→current mapping only happens once (so user-selected legacy models stay selectable).
    if (shouldRunMigration) {
      try { localStorage.setItem(migrationKey, 'done'); } catch (e) { /* ignore */ }
    }
  }

  function getAll() { return Object.values(agents); }
  function get(id) { return agents[id]; }

  function generateAvatarUrl(opts) {
    const params = new URLSearchParams();
    if (opts.seed) params.set('seed', opts.seed);
    if (opts.earrings) params.set('earrings', opts.earrings);
    if (opts.eyebrows) params.set('eyebrows', opts.eyebrows);
    if (opts.eyes) params.set('eyes', opts.eyes);
    if (opts.mouth) params.set('mouth', opts.mouth);
    if (opts.glasses) params.set('glasses', opts.glasses);
    if (opts.hair) params.set('hair', opts.hair);
    if (opts.features && opts.features.length) params.set('features', opts.features.join(','));
    if (opts.hairColor) params.set('hairColor', opts.hairColor.replace('#', ''));
    if (opts.skinColor) params.set('skinColor', opts.skinColor.replace('#', ''));
    return `https://api.dicebear.com/9.x/adventurer/svg?${params.toString()}`;
  }

  function getAvatarUrlForEmotion(agent, emotion = 'idle') {
    const baseOpts = agent?.avatarOpts || {};
    const parts = EMOTION_AVATAR_PARTS[emotion] || {};
    return generateAvatarUrl({ ...baseOpts, ...parts });
  }

  function createId() { return 'agent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); }

  async function create(data) {
    const agent = {
      id: createId(),
      name: data.name || 'Unnamed Agent',
      model: data.model || 'llama-3.1-8b-instant',
      apiKey: data.apiKey || '',
      systemPrompt: data.systemPrompt || '',
      avatarUrl: data.avatarUrl || '',
      avatarOpts: data.avatarOpts || {},
      emotion: data.emotion || 'idle',
      tools: data.tools || [],
      x: 200 + Math.random() * 600,
      y: 200 + Math.random() * 400,
      chatHistory: [],
    };
    agents[agent.id] = agent;
    await Store.saveAgent(agent);
    Canvas.addAgentToCanvas(agent);
    updateCount();
    MemoryManager.addLog('system', `Agent "${agent.name}" created`, agent.name);
    return agent;
  }

  async function save(agent) {
    agents[agent.id] = agent;
    await Store.saveAgent(agent);
  }

  async function remove(id) {
    const agent = agents[id];
    const name = agent ? agent.name : id;
    Canvas.removeAgentFromCanvas(id);
    delete agents[id];
    await Store.deleteAgent(id);
    updateCount();
    MemoryManager.addLog('system', `Agent "${name}" deleted (memories preserved)`, name);
  }

  function findAgentWithTool(toolId, excludeId) {
    return Object.values(agents).find(a =>
      a.id !== excludeId && a.tools && a.tools.includes(toolId) && ToolManager.isConnected(toolId)
    );
  }

  function updateCount() {
    document.getElementById('agent-count').textContent = Object.keys(agents).length + ' Agents';
  }

  function loadAllToCanvas() {
    Object.values(agents).forEach(a => Canvas.addAgentToCanvas(a));
    updateCount();
  }

  // Render tool permissions checkboxes in agent modal
  function renderToolPermissions(selectedTools) {
    const container = document.getElementById('tool-permissions');
    const defs = ToolManager.getDefs();
    container.innerHTML = defs.map(d => {
      const connected = ToolManager.isConnected(d.id);
      const checked = selectedTools && selectedTools.includes(d.id);
      const logoUrl = ToolManager.getLogoUrl(d.id);
      const iconHtml = logoUrl 
        ? `<img src="${logoUrl}" alt="${d.name}" class="tool-perm-icon">`
        : d.icon;
      return `<label class="tool-perm-chip ${connected ? '' : 'disabled'}">
        <input type="checkbox" value="${d.id}" class="tool-perm-cb" 
          ${checked ? 'checked' : ''} ${connected ? '' : 'disabled'}>
        ${iconHtml} ${d.name}
      </label>`;
    }).join('');
  }

  return { init, getAll, get, generateAvatarUrl, getAvatarUrlForEmotion, create, save, remove, findAgentWithTool, loadAllToCanvas, renderToolPermissions };
})();
