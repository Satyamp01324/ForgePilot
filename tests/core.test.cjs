const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { hunks, patch, selectedText, safePath, sameSnapshot, rank, redact } = require('../dist/core.js');
const { loopback, terminalStatus } = require('../dist/runtime.js');
const { files, source, retrieve } = require('../dist/workspace.js');

const change = (before, after) => ({ path: 'app.py', original: { text: before, exists: true }, proposed: after, decisions: new Map() });
test('native review payload preserves rejected and undecided hunks', () => {
  const proposal = change('one\nkeep\nthree\n', '1\nkeep\n3\n');
  assert.deepEqual(hunks(proposal).map(hunk => hunk.line), [1, 3]);
  assert.match(patch(proposal), /-one\n\+1/);
  proposal.decisions.set(0, false);
  proposal.decisions.set(1, true);
  assert.equal(selectedText(proposal), 'one\nkeep\n3\n');
  assert.equal(selectedText(proposal, true), 'one\nkeep\n3\n');
});

test('new file and zero-byte new file have a reviewable hunk', () => {
  const proposal = change('', 'new\n');
  proposal.original.exists = false;
  assert.equal(hunks(proposal).length, 1);
  assert.equal(selectedText(proposal, true), 'new\n');
  proposal.proposed = '';
  assert.equal(hunks(proposal).length, 1);
});

test('detect changes in existence, source, document version and on-disk checksum', () => {
  const base = { text: 'a', version: 3, exists: true, disk: 'hash' };
  assert.ok(sameSnapshot(base, { ...base }));
  assert.ok(sameSnapshot(base, { ...base, version: undefined }));
  assert.ok(!sameSnapshot(base, { ...base, version: undefined, disk: undefined }));
  for (const different of [{ text: 'b' }, { version: 4 }, { exists: false }, { disk: 'changed' }]) {
    assert.ok(!sameSnapshot(base, { ...base, ...different }));
  }
});

test('workspace path validation rejects traversal, secret paths, and symlinks', async t => {
  const root = await fs.mkdtemp(join(tmpdir(), 'forgepilot-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(join(root, 'app.py'), 'hello');
  await fs.symlink(join(root, 'app.py'), join(root, 'link.py'));
  assert.equal(await safePath(root, 'app.py'), join(root, 'app.py'));
  assert.equal(await safePath(root, 'new.py', true), join(root, 'new.py'));
  for (const path of ['../secret', '/tmp/z', '.env', 'a/.git/config', 'link.py', 'C:/z', 'no/new.py']) {
    await assert.rejects(safePath(root, path, true));
  }
});

test('source cap, ignored files, binary rejection and explicit ranking', async t => {
  const root = await fs.mkdtemp(join(tmpdir(), 'forgepilot-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(join(root, 'cli.py'), 'def get_debug_flag():\n  return True\n');
  await fs.writeFile(join(root, 'other.py'), 'another function');
  await fs.mkdir(join(root, 'docs'));
  await fs.mkdir(join(root, 'tests'));
  await fs.writeFile(join(root, 'docs/cli.rst'), 'CLI commands and terminal usage');
  await fs.writeFile(join(root, 'tests/test_cli.py'), 'def test_command():\n  return True\n');
  await fs.writeFile(join(root, 'config.py'), 'Application config and defaults');
  await fs.writeFile(join(root, '.env'), 'API_KEY=dummy');
  await fs.writeFile(join(root, 'bin.dat'), Buffer.from([0, 255, 0]));
  const signal = new AbortController().signal;
  const paths = await files(root, signal);
  assert.ok(!paths.includes('.env'));
  await assert.rejects(source(root, 'bin.dat'));
  await assert.rejects(source(root, 'cli.py', 5));
  const results = await retrieve(root, paths, '@symbol:get_debug_flag', 'other.py', 2, signal);
  assert.equal(results[0].path, 'cli.py');
  assert.deepEqual(results[0].symbols, ['get_debug_flag']);
  const byFile = await retrieve(root, paths, '@file:other.py', 'cli.py', 2, signal);
  assert.equal(byFile[0].path, 'other.py');
  const command = await retrieve(root, paths, 'add command and update tests and documentation', undefined, 3, signal);
  assert.ok(command.some(item => item.path === 'tests/test_cli.py'));
  assert.ok(command.some(item => item.path === 'docs/cli.rst'));
  assert.ok(rank('cli.py', '', ['cli']) > rank('other.py', '', ['cli']));
});

test('abort stops context retrieval without writing workspace files', async t => {
  const root = await fs.mkdtemp(join(tmpdir(), 'forgepilot-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = join(root, 'app.py');
  await fs.writeFile(file, 'original');
  const signal = AbortSignal.abort();
  await assert.rejects(retrieve(root, ['app.py'], 'app', undefined, 1, signal), { name: 'AbortError' });
  assert.equal(await fs.readFile(file, 'utf8'), 'original');
});

test('redact common credentials from logs', () => {
  const scrubbed = redact('API_KEY=dummy123 password=hunter2 Bearer abc.def sk-abcdefghijklm');
  for (const secret of ['dummy123', 'hunter2', 'abc.def', 'abcdefghijklm']) assert.ok(!scrubbed.includes(secret));
  assert.match(scrubbed, /\[redacted\]/);
  assert.ok(!redact('{"api_key": "dummy value"}').includes('dummy value'));
  assert.ok(!redact('-----BEGIN PRIVATE KEY-----\nsecret bytes\n-----END PRIVATE KEY-----').includes('secret bytes'));
});

test('runtime origin is restricted to HTTP loopback', () => {
  assert.equal(loopback('http://127.0.0.1:8790/'), 'http://127.0.0.1:8790');
  for (const url of ['https://localhost:8790', 'http://localhost.evil.test:8790', 'http://x@localhost', 'http://localhost/api']) {
    assert.throws(() => loopback(url));
  }
});

test('runtime rejects missing or malformed terminal events', () => {
  assert.equal(terminalStatus({ status: 'done' }), 'done');
  assert.equal(terminalStatus({ status: 'cancelled' }), 'cancelled');
  assert.deepEqual(terminalStatus({ status: 'error', message: 'provider failure' }), { error: 'provider failure' });
  for (const state of [null, {}, { status: 'ok' }, { status: 'error', message: false }]) {
    assert.throws(() => terminalStatus(state), /invalid terminal event/);
  }
});
