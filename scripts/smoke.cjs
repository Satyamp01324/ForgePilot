const assert = require('node:assert/strict');
const { bridge, loopback } = require('../dist/runtime.js');

async function main() {
  const { TrueForge } = await import('@truefoundry/trueforge-sdk');
  const client = new TrueForge({
    baseUrl: loopback(process.env.TRUEFORGE_BASE_URL || 'http://127.0.0.1:8790'),
    maxRetries: 0, timeoutInSeconds: 240,
  });
  const controller = new AbortController();
  const { signal } = controller;
  const timer = setTimeout(() => controller.abort(), 240000);
  const textOnly = process.argv.includes('--text-only');
  let called = false;
  let connector;
  let session;
  const model = process.env.FORGEPILOT_MODEL;
  try {
    if (!textOnly) {
      connector = await bridge(client, true, async (name, input) => {
        assert.equal(name, 'stage_selection');
        assert.equal(input.content, 'ForgePilot smoke');
        called = true;
        return 'Smoke tool accepted the text';
      }, signal);
      const discovery = await client.mcpServers.listTools(connector.name, { abortSignal: signal });
      assert.match(JSON.stringify(discovery.data), /stage_selection/);
      console.log('TrueForge discovered stage_selection through the loopback MCP bridge.');
      if (process.argv.includes('--discovery-only')) return;
    }
    assert.ok(model, 'Set FORGEPILOT_MODEL to a model configured in TrueForge.');
    const { data } = await client.sessions.create({ agent: { spec: {
      model: { name: model },
      config: { askUserQuestions: { enabled: false }, generativeUi: { enabled: false },
        dynamicSubAgents: { enabled: false }, sandbox: { enabled: false }, iterationLimit: 5 },
      instructions: textOnly ? 'Reply with the word ready.' : 'Call stage_selection once with content equal to ForgePilot smoke, then reply with a short confirmation.',
      mcpServers: connector ? [{ name: connector.name, preload: true, requireApprovalForTools: [] }] : [],
    } } }, { abortSignal: signal });
    session = data.id;
    const stream = await client.sessions.createTurnStream(session, {
      input: [{ type: 'user.message', content: textOnly ? 'Reply ready' : 'Call the available tool with content exactly ForgePilot smoke, then summarize the result.' }],
    }, { abortSignal: signal });
    let status;
    let text = '';
    for await (const event of stream) {
      if (event.type === 'model.message.delta') text += event.content ?? '';
      if (event.type === 'turn.done') {
        status = event.state.status;
        if (status === 'error') throw new Error(event.state.message);
      }
    }
    assert.equal(status, 'done');
    assert.ok(text.trim(), 'Missing streamed model output');
    if (connector) assert.ok(called, 'Model did not invoke the MCP tool');
    console.log('Verified model stream' + (connector ? ' and genuine MCP invocation' : '') + ' using ' + model);
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (session) await client.sessions.cancel(session, undefined, { timeoutInSeconds: 3 }).catch(() => undefined);
    await connector?.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
