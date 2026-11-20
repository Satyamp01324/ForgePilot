import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, stat, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { excluded, rank, redact, safePath } from './core';
const exec = promisify(execFile);
const decoder = new TextDecoder('utf-8', { fatal: true });
export function decodeSource(bytes: Buffer, limit: number): string {
  if (bytes.includes(0) || bytes.length > limit) throw new Error('Expected bounded UTF-8 source');
  return decoder.decode(bytes);
}

export async function files(root: string, signal: AbortSignal): Promise<string[]> {
  const { stdout } = await exec('rg', ['--files', '--null'], { cwd: root, signal, maxBuffer: 4 * 1024 * 1024, timeout: 5000 })
    .catch((error: { code: number }) => { if (error.code === 1) return { stdout: '' }; throw error; });
  return stdout.split('\0').filter(path => path && !excluded.test(path)).sort().slice(0, 4000);
}
export async function source(root: string, name: string, limit = 150000): Promise<string> {
  const path = await safePath(root, name);
  if ((await stat(path)).size > limit) throw new Error('File exceeds the size limit');
  return decodeSource(await readFile(path), limit);
}
const filler = new Set('the and for with from before after that this use using add make new update implement implementation documentation documented test tests files file into inspect stage review relevant pass should must without'.split(' '));

export function queryTerms(query: string, project?: string): string[] {
  const terms = query.toLowerCase().match(/[a-z_][\w-]{2,}/g) ?? [];
  const selected = terms.filter(term => term !== project && !filler.has(term));
  if (/\b(?:cli|commands?|terminal|console|flags?)\b/i.test(query)) selected.unshift('cli', 'command', 'console');
  return [...new Set(selected)].slice(0, 24);
}

export function excerpt(text: string, query: string, project?: string): string {
  const rows = text.split('\n');
  const terms = queryTerms(query, project);
  let best = 0;
  let position = 0;
  for (const [index, row] of rows.entries()) {
    const lower = row.toLowerCase();
    const matched = terms.filter(word => lower.includes(word)).length;
    const score = matched * 2 + (matched && /\b(?:def|class|function|command)\b/.test(lower) ? 1 : 0);
    if (score > best) { best = score; position = index; }
  }
  const start = Math.max(0, position - 3);
  return rows.slice(start, start + 17).map((row, i) => (start + i + 1) + ': ' + row).join('\n').slice(0, 650);
}
export async function retrieve(root: string, paths: string[], query: string, active: string | undefined, count: number, signal: AbortSignal) {
  const project = basename(root).split(/[-_]/)[0]?.toLowerCase();
  const words = queryTerms(query, project);
  const searchesTests = /\btests?\b/i.test(query);
  const searchesDocs = /\b(?:docs|documentation|documented)\b/i.test(query);
  const explicit = [...query.matchAll(/@file(?::|\s+)([^\s]+)|@symbol(?::|\s+)([\w.]+)/g)];
  const activeSource = active ? await source(root, active).catch(() => '') : '';
  const imports = activeSource.split('\n').filter(line => /^\s*(?:from|import)\s/.test(line)).join('\n');
  const preferred = [...paths].sort((a, b) => rank(b, '', words, active) - rank(a, '', words, active)).slice(0, 350);
  const candidates = [...new Set([...paths.filter(path => explicit.some(match => match[1] && (path === match[1] || path.endsWith('/' + match[1])))), ...preferred])];
  const ranked: { path: string; score: number; excerpt: string; symbols: string[] }[] = [];
  for (const path of candidates) {
    signal.throwIfAborted();
    const text = await source(root, path, 70000).catch(() => '');
    if (!text) continue;
    const module = path.split('/').at(-1)?.split('.')[0] ?? '';
    const isTest = /(^|\/)tests?\//.test(path);
    const isDoc = /(^|\/)docs?\//.test(path);
    const commandFile = words.includes('cli') && /(?:^|[\/_.-])cli(?:[\/_.-]|$)/i.test(path);
    const score = rank(path, text, words, active) + (module && imports.includes(module) ? 6 : 0) +
      (commandFile ? 36 : 0) + (isTest ? searchesTests ? 8 : 2 : 0) + (isDoc && searchesDocs ? 8 : 0) +
      (explicit.some(match => match[1] ? path === match[1] || path.endsWith('/' + match[1]) : match[2] && text.includes(match[2])) ? 100 : 0);
    if (score) {
      const snippet = redact(excerpt(text, query, project));
      const symbols = [...new Set([...snippet.matchAll(/\b(?:def|class|function|interface|type)\s+([a-zA-Z_]\w*)/g)]
        .map(match => match[1]))].slice(0, 8);
      ranked.push({ path, score, excerpt: snippet, symbols });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  if (!searchesTests || !searchesDocs || count < 3 || explicit.length) return ranked.slice(0, count);
  const selected = [
    ranked.find(item => !/^(?:docs?|tests?)\//.test(item.path) && /\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|cs|c|cpp|rb|php|swift)$/.test(item.path)),
    ranked.find(item => /^tests?\//.test(item.path)),
    ranked.find(item => /^docs?\//.test(item.path)),
  ].filter((item): item is (typeof ranked)[number] => item !== undefined);
  return [...new Set([...selected, ...ranked])].slice(0, count);
}

export async function isolatedPytest(root: string, paths: string[], staged: Map<string, string>, targets: string[], signal: AbortSignal) {
  if (process.platform !== 'linux') throw new Error('Isolated verification requires Linux with bubblewrap');
  if (targets.some(path => !/^tests\/[\w/.-]+\.py$/.test(path) || !paths.includes(path) && !staged.has(path))) {
    throw new Error('Select explicit Python test files under tests/');
  }
  const args = ['--unshare-all', '--die-with-parent', '--new-session', '--clearenv'];
  for (const item of ['/usr', '/lib', '/lib64', '/bin']) {
    if (await stat(item).catch(() => undefined)) args.push('--ro-bind', item, item);
  }
  args.push('--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--setenv', 'PATH', '/usr/local/bin:/usr/bin:/bin',
    '--setenv', 'HOME', '/tmp', '--setenv', 'PYTHONPATH', '/work/src');
  await exec('bwrap', [...args, '--', '/usr/bin/true'], { timeout: 3000, signal }).catch(() => {
    throw new Error('Verification disabled because bubblewrap isolation is unavailable');
  });
  const scratch = await mkdtemp(join(tmpdir(), 'forgepilot-'));
  try {
    for (const name of new Set([...paths, ...staged.keys()])) {
      signal.throwIfAborted();
      const value = staged.get(name) ?? await source(root, name).catch(() => undefined);
      if (value === undefined) continue;
      const dest = join(scratch, name);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, value);
    }
    return await new Promise<string>((resolve, reject) => {
      const child = spawn('bwrap', [...args, '--bind', scratch, '/work', '--chdir', '/work', '--',
        'python3', '-m', 'pytest', '-q', '--', ...targets], { signal, stdio: ['ignore', 'pipe', 'pipe'] });
      const timer = setTimeout(() => child.kill('SIGKILL'), 45000);
      let output = '';
      const append = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-10000); };
      child.stdout.on('data', append);
      child.stderr.on('data', append);
      child.on('error', reject);
      child.on('close', (code, termination) => {
        clearTimeout(timer);
        resolve(redact('pytest exit: ' + (code ?? termination) + '\n' + output));
      });
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
