import { createTwoFilesPatch, diffLines } from 'diff';
import { lstat, realpath } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

export const excluded = /(^|[/\\])(?:\.[^/\\]+|node_modules|dist|build|__pycache__|[^/\\]*(?:credentials|secrets)[^/\\]*|[^/\\]+\.(?:pem|key|p12|lock|min\.js))($|[/\\])/i;
export function redact(text: string): string {
  return text
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[redacted private key]')
    .replace(/(\b(?:api[_-]?(?:key|credential)|password|secret[_-]?key|token)["']?\s*[:=]\s*)(?:"[^"\n]*"?|'[^'\n]*'?|[^\s,;]+)/gi, '$1[redacted]')
    .replace(/\b(?:sk-[\w-]{12,}|gh[pousr]_[\w]{12,}|Bearer\s+[\w.-]+)/gi, '[redacted]');
}
export async function safePath(root: string, name: string, create = false): Promise<string> {
  if (!name || name.includes('\\') || name.includes(':') || excluded.test(name) ||
      name.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Path is outside the allowed workspace files');
  const base = await realpath(root);
  const path = resolve(base, name);
  if (!path.startsWith(base + sep)) throw new Error('Invalid workspace path');
  let current = base;
  const parts = relative(base, path).split(sep);
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    const info = await lstat(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT' && create && index === parts.length - 1) return undefined;
      throw error;
    });
    if (info?.isSymbolicLink() || (info && !(index === parts.length - 1 ? info.isFile() : info.isDirectory()))) {
      throw new Error('Expected a regular workspace file');
    }
  }
  return path;
}

export interface Snapshot { text: string; version?: number; disk?: string; exists: boolean }
export interface Change { path: string; original: Snapshot; proposed: string; decisions: Map<number, boolean> }
export interface Hunk { id: number; line: number; before: string; after: string }
export function hunks(change: Change): Hunk[] {
  const result: Hunk[] = [];
  let line = 1;
  let pending: Hunk | undefined;
  for (const part of diffLines(change.original.text, change.proposed)) {
    if (part.added || part.removed) {
      if (!pending) {
        pending = { id: result.length, line, before: '', after: '' };
        result.push(pending);
      }
      if (part.added) pending.after += part.value;
      else { pending.before += part.value; line += part.count ?? 0; }
    } else { pending = undefined; line += part.count ?? 0; }
  }
  if (!result.length && !change.original.exists) result.push({ id: 0, line: 1, before: '', after: '' });
  return result;
}
export function selectedText(change: Change, defaultAccept = false): string {
  let index = -1;
  let inside = false;
  let result = '';
  for (const part of diffLines(change.original.text, change.proposed)) {
    if (!part.added && !part.removed) { inside = false; result += part.value; continue; }
    if (!inside) { index++; inside = true; }
    const accept = change.decisions.get(index) ?? defaultAccept;
    if ((part.added && accept) || (part.removed && !accept)) result += part.value;
  }
  return result;
}
export function patch(change: Change): string {
  return createTwoFilesPatch(change.path, change.path, change.original.text, change.proposed);
}
export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  const sameDisk = a.disk !== undefined && a.disk === b.disk;
  const sameVersion = a.version === undefined || a.version === b.version || b.version === undefined && sameDisk;
  return a.exists === b.exists && a.text === b.text && sameVersion && (a.disk === undefined || sameDisk);
}
export function rank(path: string, source: string, words: string[], active?: string): number {
  const name = path.toLowerCase();
  const body = source.toLowerCase();
  let score = path === active ? 10 : 0;
  const related = active?.split('/').at(-1)?.split('.')[0];
  if (related && name.includes(related.toLowerCase())) score += 5;
  for (const word of words) {
    const term = word.toLowerCase();
    if (name.includes(term)) score += 8;
    if (body.includes(term)) score += 2 + Math.min(4, body.split(term).length - 2);
  }
  return score;
}
