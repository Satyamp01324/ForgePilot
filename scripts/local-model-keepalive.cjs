// Optional transport for local CPU inference with long prompt evaluation.
const http = require('node:http');

const [modelPort = '18080', proxyPort = '18082'] = process.argv.slice(2);
if (![modelPort, proxyPort].every(value => /^\d{2,5}$/.test(value) && Number(value) <= 65535) || modelPort === proxyPort) {
  throw new Error('Pass distinct model and proxy ports');
}

const server = http.createServer((request, response) => {
  const chat = request.method === 'POST' && request.url === '/v1/chat/completions';
  const models = request.method === 'GET' && request.url === '/v1/models';
  if ((!chat && !models) || request.headers.origin) {
    response.writeHead(404).end();
    return;
  }
  const headers = {};
  for (const name of ['content-type', 'content-length', 'authorization']) {
    if (request.headers[name]) headers[name] = request.headers[name];
  }
  let timer;
  const upstream = http.request({
    hostname: '127.0.0.1', port: Number(modelPort), path: request.url, method: request.method, headers,
  }, stream => {
    const type = stream.headers['content-type'] ?? 'application/json';
    response.writeHead(stream.statusCode, { 'content-type': type, 'cache-control': 'no-cache' });
    response.flushHeaders();
    let tail = '\n\n';
    if (type.includes('text/event-stream')) {
      timer = setInterval(() => {
        if (/\r?\n\r?\n$/.test(tail) && !response.writableNeedDrain) response.write(': keepalive\n\n');
      }, 15000);
    }
    stream.on('data', chunk => {
      tail = (tail + chunk.subarray(-4).toString('latin1')).slice(-4);
      if (!response.write(chunk)) {
        stream.pause();
        response.once('drain', () => stream.resume());
      }
    });
    stream.once('end', () => response.end());
    stream.once('error', () => response.destroy());
  });
  upstream.once('error', () => {
    if (response.headersSent) response.destroy();
    else response.writeHead(502).end('Local model endpoint unavailable');
  });
  response.once('close', () => {
    clearInterval(timer);
    upstream.destroy();
  });
  request.pipe(upstream);
});
server.listen(Number(proxyPort), '127.0.0.1', () => {
  console.log('Model stream keepalive listening on http://127.0.0.1:' + proxyPort + '/v1');
});
