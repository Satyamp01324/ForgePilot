const vscode = acquireVsCodeApi();
const el = id => document.getElementById(id);
const post = (type, extra = {}) => vscode.postMessage({ type, ...extra });
const button = (parent, label, action, extra) => {
  const node = document.createElement('button');
  node.textContent = label;
  node.className = 'secondary';
  node.onclick = () => post(action, extra);
  parent.append(node);
  return node;
};
const line = (parent, tag, text) => {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
};
el('prompt-form').onsubmit = event => {
  event.preventDefault();
  post('send', { query: el('prompt').value, mode: el('mode').value });
};
for (const id of ['settings', 'stop', 'retry', 'undo']) el(id).onclick = () => post(id);
let reviewKey = '';
window.addEventListener('message', ({ data }) => {
  el('status').textContent = data.status;
  el('connection').textContent = (data.connected ? 'Connected' : 'Disconnected') + (data.model ? ' · ' + data.model : '');
  el('send').disabled = data.running || data.busy || data.review;
  el('prompt').readOnly = data.running;
  el('mode').disabled = data.running;
  if (data.request) {
    el('mode').value = data.request.mode;
    el('prompt').value = data.request.query;
  }
  el('stop').disabled = !data.running;
  el('retry').disabled = !data.retry || data.running || data.busy || data.review;
  el('undo').hidden = !data.undo;
  el('undo').disabled = data.running || data.busy;
  el('response').hidden = !data.response;
  el('response').textContent = data.response;
  el('activity-panel').hidden = !data.activity.length;
  el('activity').replaceChildren();
  for (const event of data.activity) line(el('activity'), 'li', event);
  el('context-panel').hidden = !data.context.length;
  el('context').replaceChildren();
  for (const item of data.context) {
    line(el('context'), 'h3', item.path);
    if (item.symbols?.length) line(el('context'), 'p', item.symbols.join(' · '));
    line(el('context'), 'pre', item.excerpt);
  }
  el('review').hidden = !data.review;
  const key = JSON.stringify(data.changes);
  if (!data.review || reviewKey === key) return;
  reviewKey = key;
  el('changes').replaceChildren();
  el('review-actions').replaceChildren();
  for (const file of data.changes) {
    const row = document.createElement('div');
    line(row, 'h3', file.path);
    button(row, 'View diff', 'diff', { path: file.path });
    if (file.hunks.some(hunk => hunk.decision)) button(row, 'Preview accepted', 'diff', { path: file.path, approved: true });
    for (const hunk of file.hunks) {
      const item = line(row, 'div', '');
      item.className = 'hunk';
      const state = hunk.decision === undefined ? '' : hunk.decision ? ' · Accepted' : ' · Rejected';
      line(item, 'p', 'Line ' + hunk.line + ' · +' + hunk.added + ' −' + hunk.removed + state);
      button(item, 'Accept', 'hunk', { path: file.path, id: hunk.id, accept: true }).disabled = hunk.decision === true;
      button(item, 'Reject', 'hunk', { path: file.path, id: hunk.id, accept: false }).disabled = hunk.decision === false;
    }
    el('changes').append(row);
  }
  button(el('review-actions'), 'Apply accepted', 'apply').disabled = !data.changes.some(file => file.hunks.some(hunk => hunk.decision));
  button(el('review-actions'), 'Accept remaining and apply', 'acceptAll');
  button(el('review-actions'), 'Reject all', 'rejectAll');
});
post('ready');
