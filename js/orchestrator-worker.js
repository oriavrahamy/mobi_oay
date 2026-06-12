/* ═══════════ ORCHESTRATOR WORKER — Background execution of orchestration plans ═══════════ */

self.onmessage = async function(event) {
  const { type, plan, agents } = event.data;

  if (type === 'execute-plan') {
    try {
      await executePlan(plan, agents);
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: err.message
      });
    }
  }
};

async function executePlan(plan, agents) {
  const results = [];
  const agentMap = {};
  agents.forEach(a => { agentMap[a.id] = a; });

  for (const task of plan.tasks) {
    try {
      self.postMessage({
        type: 'progress',
        message: `Executing Step ${task.step}: ${task.action}...`
      });

      // Find agent
      const agent = Object.values(agentMap).find(a => a.name === task.assigned_agent);
      if (!agent) {
        throw new Error(`Agent "${task.assigned_agent}" not found`);
      }

      // Prepare input
      let input = task.parameters;
      if (task.parameters.input_from_step !== null && task.parameters.input_from_step !== undefined) {
        const refStep = task.parameters.input_from_step;
        if (results[refStep - 1]) {
          input = { ...task.parameters, data: results[refStep - 1] };
        }
      }

      // Execute task
      const output = await executeAgentTask(agent, task.action, input);
      
      results.push({
        step: task.step,
        agent: task.assigned_agent,
        output
      });

      self.postMessage({
        type: 'progress',
        message: `Completed Step ${task.step} (${results.length}/${plan.tasks.length})`
      });

    } catch (err) {
      throw new Error(`Step ${task.step} failed: ${err.message}`);
    }
  }

  // Generate final response
  const finalMessage = await generateFinalResponse(plan, results);

  self.postMessage({
    type: 'complete',
    result: finalMessage
  });
}

async function executeAgentTask(agent, action, parameters) {
  // Get API key from localStorage (will be passed from main thread if needed)
  // For now, we'll handle this in the main thread and pass results back
  
  const apiKey = agent.apiKey || localStorage.getItem('mobi-global-api-key');
  if (!apiKey) {
    throw new Error(`No API key for agent "${agent.name}"`);
  }

  const prompt = `Execute this task: ${action}\nParameters: ${JSON.stringify(parameters)}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: agent.model || 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: agent.systemPrompt || 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'API call failed');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Task completed';
  } catch (err) {
    throw new Error(`Task execution failed: ${err.message}`);
  }
}

async function generateFinalResponse(plan, results) {
  const apiKey = localStorage.getItem('mobi-global-api-key');
  if (!apiKey) {
    return `Plan completed with ${results.length} steps.`;
  }

  const resultsSummary = results.map(r => 
    `Step ${r.step} (${r.agent}): ${typeof r.output === 'string' ? r.output.substring(0, 80) : JSON.stringify(r.output).substring(0, 80)}...`
  ).join('\n');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Create a brief, friendly summary of completed task execution in 1-2 sentences. Be concise. Respond in Hebrew or English.'
          },
          {
            role: 'user',
            content: `Goal: "${plan.goal}"\n\nResults:\n${resultsSummary}`
          }
        ],
        temperature: 0.7,
        max_tokens: 256
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Plan executed successfully!';
    }
  } catch (err) {
    console.warn('Summary generation failed:', err);
  }

  return `Orchestration complete! Executed ${results.length} tasks successfully.`;
}
