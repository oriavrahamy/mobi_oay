/* ═══════════ COLLABORATION ENGINE — Multi-agent task processing ═══════════ */
const CollaborationEngine = (() => {
  function pulseEmotion(agent, emotion, resetAfter = 4500) {
    if (!agent?.id) return;
    Canvas.setAgentEmotion(agent.id, emotion, { resetAfter });
  }

  function inferEmotionFromText(text) {
    const value = (text || '').toLowerCase();
    if (/[!?]{2,}/.test(value) || /\b(wow|amazing|great|excellent|perfect|done|success|completed|happy|glad)\b/.test(value) || /(מעולה|נהדר|מצוין|בשמחה|הצלחתי|בוצע)/.test(value)) return 'happy';
    if (/\b(error|failed|sorry|unable|cannot|problem|blocked|stuck)\b/.test(value) || /(שגיאה|נכשל|מצטער|לא יכול|בעיה|תקוע)/.test(value)) return 'sad';
    if (/\b(confused|unclear|question|maybe|not sure)\b/.test(value) || /(לא ברור|שאלה|אולי|לא בטוח)/.test(value)) return 'confused';
    if (/\b(surprising|unexpected|interesting)\b/.test(value) || /(מפתיע|מעניין)/.test(value)) return 'surprised';
    return 'speaking';
  }

  async function callLLM(agent, messages) {
    const globalKey = localStorage.getItem('mobi-global-api-key') || '';
    const apiKey = agent.apiKey || globalKey;

    if (!apiKey) {
      throw new Error('No Groq API key configured. Click the Settings gear in the header to add a Global API Key, or edit this agent to add one.');
    }

    const url = 'https://api.groq.com/openai/v1/chat/completions';

    // Build tool descriptions for the agent
    const toolNames = (agent.tools || [])
      .filter(t => ToolManager.isConnected(t))
      .map(t => ToolManager.getDefById(t).name);

    // Other agents info
    const otherAgents = AgentManager.getAll()
      .filter(a => a.id !== agent.id)
      .map(a => {
        const theirTools = (a.tools || []).filter(t => ToolManager.isConnected(t)).map(t => ToolManager.getDefById(t).name);
        return `- ${a.name}: has access to [${theirTools.join(', ')}]`;
      });

    const systemInstruction = [
      agent.systemPrompt || 'You are a helpful AI agent.',
      '',
      `Your name is "${agent.name}".`,
      toolNames.length > 0
        ? `You have direct access to these tools: ${toolNames.join(', ')}.`
        : 'You currently have no tools assigned.',
      '',
      otherAgents.length > 0
        ? `Other agents on the board:\n${otherAgents.join('\n')}`
        : 'There are no other agents on the board.',
      '',
      'DELEGATION RULES:',
      '- If you need a tool you do NOT have access to, check if another agent has it.',
      '- ALWAYS think step-by-step about how to solve the problem before using a tool.',
      '- First, write your thought process in plain text. THEN, output the JSON block.',
      '- If you delegate, use a JSON block like: {"delegate":{"toolNeeded":"tool_id","targetAgent":"agent_name","task":"what you need them to do"}}',
      '- If no agent has the needed tool, use: {"deadlock":{"toolNeeded":"tool_name","reason":"explanation"}}',
      '- Only use delegation when truly necessary. If you can answer directly, do so.',
      '',
      'TOOL EXECUTION RULES:',
      '- For any Google tool (calendar, sheets, slides, docs, gmail, meet, tasks, etc.), first write your reasoning in plain text. Then output a JSON block using the "execute_javascript" tool to run the appropriate API call. Use the helper function `getGoogleToken("tool_id")` inside the script to obtain the OAuth token.',
      '- Example for Google Slides creation: {"executeTool":{"toolId":"execute_javascript","action":"run_code","params":{"code":"const token = await getGoogleToken(\'google_slides\'); const res = await fetch(\'https://slides.googleapis.com/v1/presentations\', {method:\'POST\', headers:{\'Authorization\':\`Bearer ${token}\`, \'Content-Type\':\'application/json\'}, body:JSON.stringify({title:\'My Presentation\'})}); const data = await res.json(); return data;"}}}',
      '- For read-only tools like google_gmail, you can also use execute_javascript to fetch messages.',
      '- For Home Assistant, use: {"executeTool":{"toolId":"home_assistant","action":"call_service","params":{"domain":"light","service":"turn_on","serviceData":{"entity_id":"light.office"}}}} or action "get_state" with params.entityId.',
      '- For NotebookLM, use executeTool with toolId "notebooklm". Supported actions include list_notebooks, create_notebook, rename_notebook, delete_notebook, source_list, source_add, source_add_text, source_add_drive, source_refresh, ask, chat_history, configure_chat, source_add_research, share_status, share_public, share_add, generate_audio, generate_video, generate_slide_deck, generate_quiz, generate_flashcards, generate_infographic, generate_report, generate_data_table, generate_mind_map, artifact_list, artifact_get, and download_artifact. Example: {"executeTool":{"toolId":"notebooklm","action":"ask","params":{"notebookId":"...","question":"..."}}}.',
      '',
      'SHARED MEMORY CONTEXT (recent):',
      MemoryManager.getRecentContext(10) || '(no recent activity)',
    ].join('\n');

    // Map chat history to OpenAI format
    const formattedMessages = messages.map(m => ({
      role: m.role === 'agent' ? 'assistant' : 'user',
      content: m.content
    }));

    // Insert system prompt at the beginning
    formattedMessages.unshift({
      role: 'system',
      content: systemInstruction
    });

    const body = {
      model: agent.model || 'llama-3.1-8b-instant',
      messages: formattedMessages,
      temperature: 0.8,
      max_tokens: 2048,
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      let errMsg = err.error?.message || `API error ${resp.status}`;
      if (resp.status === 401) {
        if (agent.apiKey) {
          errMsg = `API key is not valid. Please verify the Groq API Key for agent "${agent.name}". To use the Global API Key instead, edit this agent (click the gear settings icon in the chat) and clear its API Key field.`;
        } else {
          errMsg = 'API key is not valid. Please configure a valid Global Groq API Key in the settings (gear icon in the header). Get a free key at https://console.groq.com/keys.';
        }
      }
      throw new Error(errMsg);
    }

    const data = await resp.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  }

  function extractJsonObjects(text) {
    const objects = [];
    let braceCount = 0;
    let startIndex = -1;
    let inString = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (!escape && char === '"') {
        inString = !inString;
      }
      if (!inString) {
        if (char === '{') {
          if (braceCount === 0) startIndex = i;
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            objects.push(text.substring(startIndex, i + 1));
            startIndex = -1;
          }
        }
      }
      escape = (char === '\\' && !escape);
    }
    return objects;
  }

  // Parse response for delegation/deadlock
  function parseResponse(text) {
    const jsonBlocks = extractJsonObjects(text);
    
    for (const block of jsonBlocks) {
      try {
        const parsed = JSON.parse(block);
        if (parsed.delegate) return { type: 'delegate', data: parsed.delegate };
        if (parsed.deadlock) return { type: 'deadlock', data: parsed.deadlock };
        if (parsed.executeTool) return { type: 'execute', data: parsed.executeTool };
      } catch (e) {
        // ignore invalid json block
      }
    }
    
    // If we reach here, check if there's markdown code block just in case
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1]);
        if (parsed.delegate) return { type: 'delegate', data: parsed.delegate };
        if (parsed.deadlock) return { type: 'deadlock', data: parsed.deadlock };
        if (parsed.executeTool) return { type: 'execute', data: parsed.executeTool };
      } catch (err) {}
    }
    
    return { type: 'direct', text };
  }

  // Main task processing with collaboration chain
  async function processTask(agent, userMessage, depth = 0) {
    if (depth > 5) return 'Maximum delegation chain depth reached. Please try breaking your task into smaller parts.';
    Canvas.setAgentEmotion(agent.id, depth > 0 ? 'focused' : 'thinking');

    // Build messages from chat history
    const messages = [];
    if (agent.chatHistory) {
      const recent = agent.chatHistory.slice(-10).filter(m => m.role !== 'system');
      recent.forEach(m => messages.push(m));
    }
    messages.push({ role: 'user', content: userMessage });

    const rawResponse = await callLLM(agent, messages);
    const parsed = parseResponse(rawResponse);

    if (parsed.type === 'direct') {
      pulseEmotion(agent, inferEmotionFromText(parsed.text));
      return parsed.text;
    }

    if (parsed.type === 'deadlock') {
      // Show question mark on agent
      pulseEmotion(agent, 'confused', 8000);
      Canvas.showQuestionMark(agent.id);
      setTimeout(() => Canvas.hideQuestionMark(agent.id), 8000);
      MemoryManager.addLog('collaboration', `${agent.name} is stuck — needs "${parsed.data.toolNeeded}" but no agent has it`, agent.name);
      return `⚠️ I need access to **${parsed.data.toolNeeded}** to complete this task, but no agent on the board has this tool connected. ${parsed.data.reason || 'Please connect the tool or create an agent with access to it.'}`;
    }

    if (parsed.type === 'execute') {
      const { toolId, action, params } = parsed.data;
      let toolResult = '';
      
      MemoryManager.addLog('tool', `${agent.name} is executing ${action} on ${toolId}...`, agent.name);
      Canvas.setAgentEmotion(agent.id, 'focused');
      Canvas.showBubble(agent.id, `Executing ${action}...`);

      if (toolId === 'execute_javascript') {
        // Determine which Google service is being targeted (optional)
        const targetToolName = params?.targetTool || 'Google API';
        // Ask the user for approval before running any potentially mutating code
        try {
          await ChatManager.requestToolApproval(`Execute ${targetToolName}`, 'Dynamic JavaScript', 'Run generated script to interact with Google service');
        } catch (approvalErr) {
          toolResult = `Execution canceled by user: ${approvalErr.message}`;
          pulseEmotion(agent, 'sad');
          // Skip further execution and go to synthesis step
          MemoryManager.addLog('tool', `${agent.name} tool result: ${toolResult}`, agent.name);
          const synthesisPrompt = `You attempted to run a script for ${targetToolName} but it was canceled. Inform the user accordingly.`;
          const finalMessages = [...messages, { role: 'agent', content: JSON.stringify(parsed.data) }, { role: 'user', content: synthesisPrompt }];
          const finalResponse = await callLLM(agent, finalMessages);
          pulseEmotion(agent, inferEmotionFromText(finalResponse));
          setTimeout(() => Canvas.hideBubble(agent.id), 2000);
          return finalResponse;
        }
        const code = params?.code || '';
        try {
          const getGoogleToken = async (toolId) => {
            const state = ToolManager.getState(toolId);
            if (!state || !state.connected || !state.credentials?.token) {
              throw new Error(`Tool ${toolId} is not connected or token missing`);
            }
            return state.credentials.token;
          };
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          const execFn = new AsyncFunction('getGoogleToken', code);
          const result = await execFn(getGoogleToken);
          toolResult = `Script executed successfully. Result: ${JSON.stringify(result)}`;
        } catch (e) {
          toolResult = `Script execution failed: ${e.message}`;
        }
      } else if (toolId === 'google_sheets') {
        const code = params?.code || '';
        try {
          const getGoogleToken = async (toolId) => {
            const state = ToolManager.getState(toolId);
            if (!state || !state.connected || !state.credentials?.token) {
              throw new Error(`Tool ${toolId} is not connected or token missing`);
            }
            return state.credentials.token;
          };
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          const execFn = new AsyncFunction('getGoogleToken', code);
          const result = await execFn(getGoogleToken);
          toolResult = `Script executed successfully. Result: ${JSON.stringify(result)}`;
        } catch (e) {
          toolResult = `Script execution failed: ${e.message}`;
        }
      } else if (toolId === 'google_sheets') {
        const targetFile = params?.filename || params?.spreadsheet || params?.targetFile || params?.spreadsheetId || 'Spreadsheet';
        const actionDesc = params?.description || params?.actionDesc || params?.action || action || 'Write data to sheets';
        try {
          await ChatManager.requestToolApproval(ToolManager.getDefById(toolId).name, targetFile, actionDesc);
          toolResult = `Successfully wrote data to ${targetFile}.`;
        } catch (e) {
          toolResult = `Execution canceled: ${e.message}`;
        }
      } else if (toolId === 'home_assistant') {
        const state = ToolManager.getState('home_assistant');
        const baseUrl = (state.credentials?.clientId || '').replace(/\/$/, '');
        const token = state.credentials?.apiKey || state.credentials?.token || '';
        if (!baseUrl || !token) {
          toolResult = 'Home Assistant is not fully configured. Connect it with a Base URL and Long-Lived Access Token.';
        } else {
          try {
            let endpoint = params?.endpoint || '';
            let method = params?.method || 'GET';
            let body = params?.body || null;
            if (action === 'get_state') {
              endpoint = `/api/states/${encodeURIComponent(params?.entityId || params?.entity_id || '')}`;
              method = 'GET';
            } else if (action === 'call_service') {
              endpoint = `/api/services/${params?.domain}/${params?.service}`;
              method = 'POST';
              body = params?.serviceData || params?.data || {};
            }
            if (!endpoint || endpoint.includes('undefined')) throw new Error('Missing Home Assistant endpoint, entity, domain, or service');
            const haRes = await fetch(baseUrl + endpoint, {
              method,
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: method === 'GET' ? undefined : JSON.stringify(body || {})
            });
            const haData = await haRes.json().catch(() => ({}));
            toolResult = haRes.ok
              ? `Home Assistant ${action} succeeded: ${JSON.stringify(haData)}`
              : `Home Assistant ${action} failed (${haRes.status}): ${JSON.stringify(haData)}`;
          } catch (e) {
            toolResult = `Home Assistant execution failed: ${e.message}`;
          }
        }
      } else if (toolId === 'notebooklm') {
        const state = ToolManager.getState('notebooklm');
        const bridgeUrl = state.credentials?.apiKey || '';
        const cliCommand = state.credentials?.clientId || 'notebooklm';
        const profile = state.credentials?.clientSecret || 'default';
        if (bridgeUrl) {
          try {
            const nbRes = await fetch(bridgeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, params: { ...(params || {}), cliCommand }, profile, cliCommand })
            });
            const nbData = await nbRes.json().catch(() => ({}));
            toolResult = nbRes.ok
              ? `NotebookLM ${action} succeeded: ${JSON.stringify(nbData)}`
              : `NotebookLM bridge failed (${nbRes.status}): ${JSON.stringify(nbData)}`;
          } catch (e) {
            toolResult = `NotebookLM bridge request failed: ${e.message}`;
          }
        } else {
          toolResult = `NotebookLM is configured for notebooklm-py CLI use, but this browser app needs a local bridge endpoint to execute it directly. Install with: pip install "notebooklm-py[browser]" && playwright install chromium && ${cliCommand} login. Then expose a local bridge URL in the NotebookLM tool settings. Requested action: ${action}; params: ${JSON.stringify(params || {})}`;
        }
      } else if (toolId === 'google_gmail') {
        const code = `const token = await getGoogleToken('google_gmail'); const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages', {headers:{'Authorization':\`Bearer ${token}\`}}); const data = await res.json(); return data;`;
        try {
          const getGoogleToken = async (toolId) => {
            const state = ToolManager.getState(toolId);
            if (!state || !state.connected || !state.credentials?.token) throw new Error('Token missing');
            return state.credentials.token;
          };
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          const execFn = new AsyncFunction('getGoogleToken', code);
          const result = await execFn(getGoogleToken);
          toolResult = `Fetched Gmail data: ${JSON.stringify(result)}`;
        } catch (e) {
          toolResult = `Gmail fetch failed: ${e.message}`;
        }
      } else if (toolId === 'google_calendar' && action === 'createEvent') {
        const state = ToolManager.getState('google_calendar');
        if (state && state.connected && state.credentials?.token) {
          try {
            const evBody = {
              summary: params.summary,
              end: { dateTime: params.end || new Date(Date.now() + 3600000).toISOString() }
            };
            const gcalRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${state.credentials.token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(evBody)
            });
            if (gcalRes.ok) {
              const resData = await gcalRes.json();
              toolResult = `Successfully created calendar event: ${resData.htmlLink}`;
            } else {
              const errorData = await gcalRes.json();
              toolResult = `Failed to create calendar event. Google API Error: ${errorData.error?.message || gcalRes.statusText}`;
            }
          } catch (e) {
            toolResult = `Error communicating with Google Calendar API: ${e.message}`;
          }
        } else {
          toolResult = 'Failed: Google Calendar tool is not properly connected or token is missing.';
        }
      } else {
        // Fallback mock execution for other tools
        toolResult = `Simulated execution of ${action} on ${toolId} completed successfully.`;
      }

      MemoryManager.addLog('tool', `${agent.name} tool result: ${toolResult}`, agent.name);
      
      // Feed result back to LLM to generate final natural response
      const synthesisPrompt = `You executed the tool "${toolId}" (Action: ${action}). The result was:\n"${toolResult}"\nNow inform the user about the result naturally. DO NOT output JSON.`;
      const finalMessages = [...messages, { role: 'agent', content: JSON.stringify(parsed.data) }, { role: 'user', content: synthesisPrompt }];
      const finalResponse = await callLLM(agent, finalMessages);
      pulseEmotion(agent, inferEmotionFromText(finalResponse));
      
      setTimeout(() => Canvas.hideBubble(agent.id), 2000);
      return finalResponse;
    }

    if (parsed.type === 'delegate') {
      const { toolNeeded, targetAgent: targetName, task } = parsed.data;

      // Find the tool id
      const toolDefs = ToolManager.getDefs();
      const toolDef = toolDefs.find(t =>
        t.name.toLowerCase().includes((toolNeeded || '').toLowerCase()) ||
        t.id.toLowerCase().includes((toolNeeded || '').toLowerCase())
      );
      const toolId = toolDef ? toolDef.id : toolNeeded;

      // Find target agent
      let target = null;
      if (targetName) {
        target = AgentManager.getAll().find(a =>
          a.id !== agent.id && a.name.toLowerCase().includes(targetName.toLowerCase())
        );
      }
      if (!target) {
        target = AgentManager.findAgentWithTool(toolId, agent.id);
      }

      if (!target) {
        // Deadlock
        pulseEmotion(agent, 'confused', 8000);
        Canvas.showQuestionMark(agent.id);
        setTimeout(() => Canvas.hideQuestionMark(agent.id), 8000);
        MemoryManager.addLog('collaboration', `${agent.name} needs "${toolNeeded}" — no agent found`, agent.name);
        return `⚠️ I need to delegate to an agent with **${toolNeeded}**, but no available agent has this tool. Please connect it or create an agent with access.`;
      }

      // ═══ VISUAL COLLABORATION ═══
      MemoryManager.addLog('collaboration', `${agent.name} → walking to ${target.name} (needs ${toolNeeded})`, agent.name);
      Canvas.setAgentEmotion(agent.id, 'focused');

      // Show bubble on source
      Canvas.showBubble(agent.id, `Going to ${target.name}...`);

      // Draw connection line
      Canvas.drawConnectionLine(agent.id, target.id);

      // Walk to target
      const targetPos = Canvas.getAgentPos(target.id);
      await Canvas.moveAgentTo(agent.id, targetPos.x + 80, targetPos.y);

      // Show conversation bubbles
      Canvas.showBubble(agent.id, `Can you help with: ${task?.substring(0, 30)}...`);
      Canvas.showBubble(target.id, 'Processing...');
      Canvas.setAgentEmotion(agent.id, 'speaking');
      Canvas.setAgentEmotion(target.id, 'thinking');

      // Store inter-agent chat
      if (!agent._interChat) agent._interChat = [];
      agent._interChat.push({ from: agent.id, fromName: agent.name, text: `I need help: ${task}` });

      // Call the target agent
      MemoryManager.addLog('collaboration', `${agent.name} asks ${target.name}: "${task?.substring(0, 100)}"`, agent.name);

      let delegateResponse;
      try {
        delegateResponse = await processTask(target, `Agent "${agent.name}" is requesting your help: ${task}`, depth + 1);
      } catch (err) {
        delegateResponse = `Error from ${target.name}: ${err.message}`;
        pulseEmotion(target, 'sad');
      }

      // Show response in bubble
      Canvas.showBubble(target.id, delegateResponse.substring(0, 40) + '...');
      pulseEmotion(target, inferEmotionFromText(delegateResponse));

      // Store inter-agent response
      agent._interChat.push({ from: target.id, fromName: target.name, text: delegateResponse });
      if (!target._interChat) target._interChat = [];
      target._interChat.push({ from: agent.id, fromName: agent.name, text: task });
      target._interChat.push({ from: target.id, fromName: target.name, text: delegateResponse });

      MemoryManager.addLog('collaboration', `${target.name} responds to ${agent.name}: "${delegateResponse.substring(0, 100)}"`, target.name);

      // Walk back (return to original position — slightly offset)
      await new Promise(r => setTimeout(r, 1500));
      const origPos = Canvas.getAgentPos(agent.id);
      await Canvas.moveAgentTo(agent.id, origPos.x - 80, origPos.y);

      // Clean up visuals
      Canvas.removeConnectionLine(agent.id, target.id);
      setTimeout(() => {
        Canvas.hideBubble(agent.id);
        Canvas.hideBubble(target.id);
      }, 3000);

      // Now ask the original agent to synthesize the response
      const synthesisPrompt = `You asked agent "${target.name}" for help with: "${task}". They responded with: "${delegateResponse}". Now synthesize this into your final answer for the user. Respond naturally, do NOT use delegation JSON.`;

      const finalMessages = [{ role: 'user', content: synthesisPrompt }];
      const finalResponse = await callLLM(agent, finalMessages);
      pulseEmotion(agent, inferEmotionFromText(finalResponse));

      return finalResponse;
    }

    return rawResponse;
  }

  return { processTask, callLLM };
})();
