const { redact } = require('../dist/core.js');

async function main() {
  const { TrueForge } = await import('@truefoundry/trueforge-sdk');
  const client = new TrueForge({ baseUrl: 'http://127.0.0.1:8790', maxRetries: 0 });
  const [name, port, upstream, outputLimit = '1600', contextLimit = '8192'] = process.argv.slice(2);
  if (!name || !/^\d{2,5}$/.test(port ?? '') || !upstream ||
      !/^\d{3,5}$/.test(outputLimit) || !/^\d{4,6}$/.test(contextLimit)) {
    throw new Error('Usage: node scripts/local-provider.cjs PROVIDER PORT UPSTREAM_MODEL [MAX_OUTPUT_TOKENS] [CONTEXT_TOKENS]');
  }
  const model = 'coding-model';
  await client.settings.modelProviders.createOrUpdate({ manifest: {
    name, type: 'custom', baseUrl: 'http://127.0.0.1:' + port + '/v1',
    models: [{ name: model, modelId: upstream, properties: { contextLength: Number(contextLimit), maxOutputTokens: Number(outputLimit) } }],
  } });
  console.log(name + '/' + model);
}
main().catch(error => { console.error(redact(error.message)); process.exitCode = 1; });
