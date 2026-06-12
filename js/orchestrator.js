/* ═══════════ ORCHESTRATOR — Global agent orchestration & task execution ═══════════ */
const OrchestratorManager = (() => {
  let isProcessing = false;
  let currentPlan = null;
  let orchestratorWorker = null;

  function init() {
    console.log('[Orchestrator] Initializing...');
    
    // Verify container visibility
    const container = document.getElementById('orchestrator-container');
    console.log('[Orchestrator] Container found:', !!container);
    if (container) {
      console.log('[Orchestrator] Container display:', window.getComputedStyle(container).display);
    }
    
    const input = document.getElementById('orchestrator-input');
    const sendBtn = document.getElementById('orchestrator-send-btn');
    
    if (!input || !sendBtn) {
      console.error('[Orchestrator] Missing DOM elements:', { input: !!input, sendBtn: !!sendBtn });
      return;
    }

    console.log('[Orchestrator] DOM elements found, attaching listeners...');
    
    // Auto-resize textarea
    input.addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    });

    // Send on Enter+Ctrl, Cmd+Enter, or button click
    input.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        console.log('[Orchestrator] Enter+Ctrl pressed');
        submitTask();
        e.preventDefault();
      }
    });

    sendBtn.addEventListener('click', () => {
      console.log('[Orchestrator] Send button clicked');
      submitTask();
    });

    // Plan execution button
    const executeBtn = document.getElementById('orchestrator-execute-btn');
    if (executeBtn) {
      executeBtn.addEventListener('click', executePlan);
    }

    // Initialize Web Worker for orchestration
    initializeWorker();
    
    console.log('[Orchestrator] Initialization complete');
  }

  function initializeWorker() {
    if (typeof Worker !== 'undefined') {
      try {
        orchestratorWorker = new Worker('js/orchestrator-worker.js');
        orchestratorWorker.onmessage = handleWorkerMessage;
        orchestratorWorker.onerror = (err) => {
          console.error('Orchestrator Worker Error:', err.message);
          showError(`Worker Error: ${err.message}`);
        };
      } catch (e) {
        console.warn('Web Workers not available, using main thread', e);
      }
    }
  }

  function getGlobalModelConfig() {
    const service = localStorage.getItem('mobi-model-service') || 'groq';
    const localEndpoint = localStorage.getItem('mobi-lmstudio-url') || '';
    const localModel = localStorage.getItem('mobi-lmstudio-model') || '';
    const apiKey = localStorage.getItem('mobi-global-api-key') || '';
    return { service, localEndpoint, localModel, apiKey };
  }

  async function sendChatRequest(config, messages, temperature = 0.7, maxTokens = 1024) {
    const { service, localEndpoint, localModel, apiKey, model } = config;
    const requestModel = model || (service === 'lmstudio' ? localModel : undefined);

    if (service === 'lmstudio') {
      if (!localEndpoint || !requestModel) {
        throw new Error('Local LM Studio endpoint or model is not configured.');
      }
      let url = localEndpoint.replace(/\/+$/, '');
      if (!url.endsWith('/v1/chat/completions') && !url.endsWith('/chat/completions')) {
        url += '/v1/chat/completions';
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: requestModel,
          messages,
          temperature,
          max_tokens: maxTokens
        })
      });
      return response;
    }

    if (!apiKey) {
      throw new Error('Global Groq API key not configured. Please add one in Settings.');
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: requestModel || 'llama-3.1-8b-instant',
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });

    return response;
  }

  function getAgentChatConfig(agent) {
    const globalConfig = getGlobalModelConfig();
    if (globalConfig.service === 'lmstudio') {
      return {
        service: 'lmstudio',
        localEndpoint: globalConfig.localEndpoint,
        model: agent.model || globalConfig.localModel,
        apiKey: ''
      };
    }
    return {
      service: 'groq',
      model: agent.model || 'llama-3.1-8b-instant',
      apiKey: agent.apiKey || globalConfig.apiKey
    };
  }

  async function submitTask() {
    console.log('[Orchestrator] submitTask called');
    
    const input = document.getElementById('orchestrator-input');
    if (!input) {
      console.error('[Orchestrator] Input element not found');
      return;
    }
    
    const text = input.value.trim();
    
    console.log('[Orchestrator] Input text:', text);
    console.log('[Orchestrator] Is processing:', isProcessing);

    if (!text || isProcessing) {
      console.warn('[Orchestrator] Skipping: empty text or already processing');
      return;
    }

    isProcessing = true;
    input.disabled = true;
    
    showProgress('Generating execution plan...');

    try {
      // Get all active agents
      const agents = AgentManager.getAll();
      console.log('[Orchestrator] Active agents:', agents.length);
      
      if (agents.length === 0) {
        throw new Error('No agents available. Create agents first.');
      }

      // Prepare agent context
      const agentContext = agents.map(a => ({
        id: a.id,
        name: a.name,
        role: a.systemPrompt || 'General Purpose Agent',
        tools: a.tools || []
      }));

      // Get recent context from memory
      const recentContext = MemoryManager.getRecentContext(10);

      console.log('[Orchestrator] Generating execution plan...');
      
      // Call Gemini to generate execution plan
      const plan = await generateExecutionPlan(text, agentContext, recentContext);
      
      console.log('[Orchestrator] Plan generated:', plan);
      
      // Store plan and show modal
      currentPlan = plan;
      showPlanPreview(plan);
      
      // Log to memory
      MemoryManager.addLog('task', `Orchestrator Plan Generated: ${plan.goal}`, 'סוכן על');
      
      input.value = '';
      input.style.height = 'auto';
    } catch (err) {
      console.error('[Orchestrator] Error:', err);
      showError(err.message);
      MemoryManager.addLog('system', `Orchestration Error: ${err.message}`, 'סוכן על');
    } finally {
      isProcessing = false;
      input.disabled = false;
      hideProgress();
      input.focus();
    }
  }

  async function generateExecutionPlan(userGoal, agentContext, recentContext) {
    const modelConfig = getGlobalModelConfig();
    console.log('[Orchestrator] Model service:', modelConfig.service, 'model:', modelConfig.localModel || 'default');

    const systemPrompt = `You are an expert orchestrator agent (סוכן על) responsible for breaking down complex user goals into executable subtasks.

Your job:
1. Analyze the user's goal and available agents
2. Generate a structured execution plan as JSON
3. Ensure each task is assigned to an appropriate agent
4. Define clear dependencies and data flow between steps

IMPORTANT: Output ONLY valid JSON (no markdown, no explanations).

Available agents:
${agentContext.map(a => `- ${a.name}: ${a.role} (Tools: ${a.tools.join(', ') || 'None'})`).join('\n')}

Recent context:
${recentContext}

Respond with ONLY this JSON structure (no markdown, no backticks):
{
  "goal": "user's goal in brief",
  "tasks": [
    {
      "step": 1,
      "assigned_agent": "Agent Name",
      "action": "action_name",
      "parameters": { "key": "value", "input_from_step": null },
      "description": "human readable task description"
    }
  ]
}`;

    try {
      console.log('[Orchestrator] Calling model service...');
      const modelConfig = getGlobalModelConfig();
      const response = await sendChatRequest(modelConfig, [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userGoal
        }
      ], 0.7, 2048);

      console.log('[Orchestrator] Model service response status:', response.status);

      if (!response.ok) {
        const errData = await response.json();
        console.error('[Orchestrator] API Error:', errData);
        throw new Error(errData.error?.message || `Model service Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Orchestrator] Model service response received');
      
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('Empty response from Groq API');
      }

      console.log('[Orchestrator] Response content (first 200 chars):', content.substring(0, 200));

      // Parse JSON (remove markdown if present)
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      
      console.log('[Orchestrator] Parsing JSON...');
      const plan = JSON.parse(jsonStr);
      
      console.log('[Orchestrator] Plan parsed successfully:', plan);
      
      // Validate plan structure
      if (!plan.goal || !Array.isArray(plan.tasks)) {
        throw new Error('Invalid execution plan structure');
      }

      return plan;
    } catch (err) {
      console.error('[Orchestrator] Generation error:', err);
      if (err instanceof SyntaxError) {
        throw new Error(`Failed to parse execution plan: ${err.message}`);
      }
      throw err;
    }
  }

  function showPlanPreview(plan) {
    const overlay = document.getElementById('orchestrator-plan-overlay');
    const goalEl = document.getElementById('plan-goal');
    const tasksEl = document.getElementById('plan-tasks');

    goalEl.textContent = plan.goal;
    
    tasksEl.innerHTML = plan.tasks.map((task, idx) => `
      <div class="task-item">
        <div class="task-step">
          <div class="task-number">${task.step}</div>
          <div class="task-agent">
            <div class="task-agent-name">${task.assigned_agent}</div>
            <div class="task-action">${task.action}</div>
          </div>
        </div>
        <div class="task-description">${task.description}</div>
      </div>
    `).join('');

    overlay.classList.add('active');
  }

  function hidePlanPreview() {
    const overlay = document.getElementById('orchestrator-plan-overlay');
    overlay.classList.remove('active');
  }

  async function executePlan() {
    if (!currentPlan || !currentPlan.tasks.length) return;

    hidePlanPreview();
    showProgress(`Executing ${currentPlan.tasks.length} tasks...`);
    isProcessing = true;
    if (window.Microbit) window.Microbit.sendState('THINK');

    try {
      if (orchestratorWorker) {
        // Use Web Worker for async execution
        orchestratorWorker.postMessage({
          type: 'execute-plan',
          plan: currentPlan,
          agents: AgentManager.getAll(),
          globalModelConfig: getGlobalModelConfig()
        });
      } else {
        // Fallback to main thread
        await executePlanMainThread(currentPlan);
      }
    } catch (err) {
      console.error('Plan execution error:', err);
      showError(`Execution error: ${err.message}`);
      MemoryManager.addLog('system', `Execution Error: ${err.message}`, 'סוכן על');
      isProcessing = false;
      hideProgress();
    }
  }

  async function executePlanMainThread(plan) {
    const results = [];
    let lastOutput = null;

    for (const task of plan.tasks) {
      try {
        // Find assigned agent
        const agent = AgentManager.getAll().find(a => a.name === task.assigned_agent);
        if (!agent) {
          throw new Error(`Agent "${task.assigned_agent}" not found`);
        }

        // Prepare input (use output from previous step if referenced)
        let input = task.parameters;
        if (task.parameters.input_from_step !== null && task.parameters.input_from_step !== undefined) {
          const refStep = task.parameters.input_from_step;
          if (results[refStep - 1]) {
            input = { ...task.parameters, data: results[refStep - 1].output };
          }
        }

        // Activate agent visualization
        Canvas.setAgentEmotion(agent.id, 'thinking');
        activateAgentPulse(agent.id);

        // Execute task via agent
        const output = await executeAgentTask(agent, task.action, input);
        if (window.Microbit) window.Microbit.sendState('SPEAK');
        
        results.push({
          step: task.step,
          agent: task.assigned_agent,
          output
        });

        lastOutput = output;

        // Deactivate pulse
        deactivateAgentPulse(agent.id);
        Canvas.setAgentEmotion(agent.id, 'happy');

        // Log task completion
        MemoryManager.addLog('task', `Step ${task.step}: ${task.assigned_agent} completed "${task.action}"`, task.assigned_agent);

        // Update progress
        const progressText = `${results.length}/${plan.tasks.length} tasks completed...`;
        updateProgress(progressText);

      } catch (err) {
        console.error(`Task ${task.step} failed:`, err);
        MemoryManager.addLog('system', `Task ${task.step} failed: ${err.message}`, task.assigned_agent);
        throw err;
      }
    }

    // All tasks completed - aggregate results
    await generateFinalResponse(plan, results, lastOutput);
    if (window.Microbit) window.Microbit.sendState('IDLE');
  }

  async function executeAgentTask(agent, action, parameters) {
    const prompt = `Execute this task: ${action} with parameters: ${JSON.stringify(parameters)}`;
    const agentConfig = getAgentChatConfig(agent);

    if (agentConfig.service === 'groq' && !agentConfig.apiKey) {
      throw new Error(`No API key for agent "${agent.name}"`);
    }

    try {
      const response = await sendChatRequest(agentConfig, [
        {
          role: 'system',
          content: agent.systemPrompt || 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], 0.5, 1024);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Agent API call failed');
      }
      
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      throw new Error(`Task execution failed: ${err.message}`);
    }
  }

  async function generateFinalResponse(plan, results, lastOutput) {
    const modelConfig = getGlobalModelConfig();
    const resultsSummary = results.map(r => 
      `Step ${r.step} (${r.agent}): ${r.output.substring(0, 100)}...`
    ).join('\n');

    try {
      const response = await sendChatRequest(modelConfig, [
        {
          role: 'system',
          content: 'You are an expert summarizer. Create a brief, human-friendly summary of task execution results in Hebrew or English.'
        },
        {
          role: 'user',
          content: `Goal: ${plan.goal}\n\nExecution Results:\n${resultsSummary}`
        }
      ], 0.7, 512);

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || lastOutput;
      }
    } catch (err) {
      console.warn('Could not generate final summary:', err);
    }

    return lastOutput;
  }

  function handleWorkerMessage(event) {
    const { type, message, progress, result, error } = event.data;

    if (type === 'progress') {
      updateProgress(message);
      if (window.Microbit && message.includes('completed')) window.Microbit.sendState('SPEAK');
    } else if (type === 'complete') {
      showCompletionMessage(result);
      isProcessing = false;
      hideProgress();
      MemoryManager.addLog('task', `Orchestration Complete: ${result}`, 'סוכן על');
      if (window.Microbit) window.Microbit.sendState('IDLE');
    } else if (type === 'error') {
      showError(error);
      isProcessing = false;
      hideProgress();
      if (window.Microbit) window.Microbit.sendState('IDLE');
    }
  }

  function activateAgentPulse(agentId) {
    const agentEl = document.querySelector(`[data-agent-id="${agentId}"]`);
    if (agentEl) {
      agentEl.classList.add('orchestrator-active');
    }
  }

  function deactivateAgentPulse(agentId) {
    const agentEl = document.querySelector(`[data-agent-id="${agentId}"]`);
    if (agentEl) {
      agentEl.classList.remove('orchestrator-active');
    }
  }

  function showProgress(message = 'Processing...') {
    console.log('[Orchestrator] showProgress:', message);
    const progressEl = document.getElementById('orchestrator-progress');
    const textEl = document.getElementById('progress-text');
    
    if (!progressEl || !textEl) {
      console.error('[Orchestrator] Progress elements not found');
      return;
    }
    
    textEl.textContent = message;
    progressEl.style.display = 'flex';
  }

  function updateProgress(message) {
    console.log('[Orchestrator] updateProgress:', message);
    const textEl = document.getElementById('progress-text');
    if (textEl) textEl.textContent = message;
  }

  function hideProgress() {
    console.log('[Orchestrator] hideProgress');
    const progressEl = document.getElementById('orchestrator-progress');
    if (progressEl) progressEl.style.display = 'none';
  }

  function showError(message) {
    const input = document.getElementById('orchestrator-input');
    const oldPlaceholder = input.placeholder;
    
    input.style.borderColor = '#ef4444';
    input.placeholder = `❌ ${message}`;
    
    setTimeout(() => {
      input.style.borderColor = '';
      input.placeholder = oldPlaceholder;
    }, 4000);
  }

  function showCompletionMessage(message) {
    const container = document.getElementById('orchestrator-container');
    const msgEl = document.createElement('div');
    msgEl.style.cssText = `
      background: #22c55e;
      color: white;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 0.9rem;
      margin-top: 8px;
      animation: slideIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
    `;
    msgEl.textContent = `✅ ${message}`;
    
    container.appendChild(msgEl);
    
    setTimeout(() => msgEl.remove(), 5000);
  }

  return { init };
})();
