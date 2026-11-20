const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

exports.run = async function () {
  const vscode = require('vscode');
  const extension = vscode.extensions.getExtension('forgepilot-ai.forgepilot-ai');
  assert.ok(extension, 'ForgePilot extension is registered');
  const pilot = await extension.activate();
  assert.equal(extension.isActive, true);
  const commands = await vscode.commands.getCommands();
  for (const id of ['forgepilot.inline', 'forgepilot.agent', 'forgepilot.undo']) assert.ok(commands.includes(id), id);
  const evidence = ['PASS: ForgePilot activated and all three contributed commands registered.'];
  const model = process.env.FORGEPILOT_MODEL;
  const recording = !!process.env.FORGEPILOT_RECORD;
  const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  try {
    if (!model) return;
    const config = vscode.workspace.getConfiguration('forgepilot');
    await config.update('model', model, vscode.ConfigurationTarget.Global);
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const name = 'src/flask/helpers.py';
    const path = join(root, name);
    const checksum = () => createHash('sha256').update(readFileSync(path)).digest('hex');
    const gitStatus = () => execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8' });
    const treeHash = () => {
      const hash = createHash('sha256');
      const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
      for (const file of tracked) hash.update(file + '\0').update(readFileSync(join(root, file))).update('\0');
      return hash.digest('hex');
    };
    if (recording) {
      await vscode.commands.executeCommand('forgepilot.sidebar.focus');
      await pause(2500);
    }
    const before = checksum();
    const beforeTree = treeHash();
    const status = gitStatus();
    if (process.env.FORGEPILOT_FAILURE_MODEL) {
      await config.update('model', process.env.FORGEPILOT_FAILURE_MODEL, vscode.ConfigurationTarget.Global);
      await pilot.run('Inspect Flask CLI configuration and report what you find.', 'agent');
      const failed = pilot.state();
      assert.equal(failed.running, false);
      assert.equal(failed.review, false);
      assert.match(failed.status, /error|fetch|connect|ECONNREFUSED|failed|unavailable/i);
      assert.equal(checksum(), before);
      assert.equal(gitStatus(), status);
      assert.equal(treeHash(), beforeTree);
      evidence.push('PASS: Real TrueForge failure displayed, no staged changes, Flask Git status and tracked-file checksums unchanged.', failed.status);
      if (recording) {
        const output = vscode.window.createOutputChannel('ForgePilot demo verification');
        output.appendLine('A genuine TrueForge provider error occurred: ' + failed.status);
        output.appendLine('Tracked Flask tree SHA-256 before: ' + beforeTree);
        output.appendLine('Tracked Flask tree SHA-256 after:  ' + treeHash());
        output.appendLine('Git status matched before and after.');
        output.show(true);
        await pause(5500);
      }
      await config.update('model', model, vscode.ConfigurationTarget.Global);
    }

    if (process.env.FORGEPILOT_FAILURE_ONLY) return;
    if (process.env.FORGEPILOT_CANCEL_ONLY) {
      const running = pilot.run('Search this repository for CLI entry points and summarize their roles.', 'agent');
      const start = Date.now();
      while (!pilot.state().activity.some(line => line.includes('initialized workspace tools'))) {
        assert.ok(pilot.state().running && Date.now() - start < 15000, pilot.state().status);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const activeSession = pilot.state().session;
      assert.ok(activeSession);
      pilot.stop();
      assert.equal(pilot.state().running, false);
      assert.equal(pilot.state().review, false);
      await running;
      assert.equal(treeHash(), beforeTree);
      const { TrueForge } = await import('@truefoundry/trueforge-sdk');
      const client = new TrueForge({ baseUrl: 'http://127.0.0.1:8790', maxRetries: 0 });
      let cancelled = false;
      for (let i = 0; i < 30 && !cancelled; i++) {
        for await (const turn of await client.sessions.listTurns(activeSession)) {
          if (turn.state.status === 'cancelled') cancelled = true;
        }
        if (!cancelled) await new Promise(resolve => setTimeout(resolve, 200));
      }
      assert.ok(cancelled, 'TrueForge did not report the turn cancelled');
      evidence.push('PASS: Stop cleared the extension immediately, TrueForge confirmed cancellation, and the Flask tree was unchanged.');
      return;
    }
    if (process.env.FORGEPILOT_TASK === 'B') {
      await config.update('runTimeoutSeconds', 1800, vscode.ConfigurationTarget.Global);
      await pilot.run('Implement a new built-in Flask CLI command named flask config that displays the loaded application configuration as valid JSON. Recursively mask sensitive keys including secrets, passwords, tokens and API credentials. Handle unsupported values safely. Add automated tests and update the documentation. Independently find how existing built-in commands are registered, then locate the relevant tests and documentation. The new command needs to be added. Use exact targeted replacements for existing files. Keep edits focused and stage the implementation, tests and documentation before replying. Stage all changes for review. Do not run pytest in this environment.', 'agent');
      const state = pilot.state();
      evidence.push(JSON.stringify(state, null, 2));
      assert.ok(state.proposed.length >= 3, 'Expected implementation, test, and documentation files');
      if (recording) {
        for (const path of state.proposed.slice(0, 3)) {
          await pilot.review(path);
          await pause(4000);
        }
      }
      await pilot.apply();
      for (const doc of vscode.workspace.textDocuments) if (doc.isDirty) await doc.save();
      evidence.push('PASS: Three or more agent-discovered files were approved and applied in VS Code.');
      if (recording) await pause(5500);
      return;
    }

    const doc = await vscode.workspace.openTextDocument(path);
    const editor = await vscode.window.showTextDocument(doc);
    const start = doc.getText().indexOf('def get_debug_flag(');
    const end = doc.getText().indexOf('\n\n', start);
    assert.ok(start >= 0 && end > start);
    editor.selection = new vscode.Selection(doc.positionAt(start), doc.positionAt(end));
    await pilot.run('Modify the selected function so off and disabled are additional case-insensitive false values. Preserve all existing behavior. Stage the full selected function including the signature and docstring.', 'inline');
    const result = pilot.state();
    evidence.push(JSON.stringify(result, null, 2));
    assert.deepEqual(result.proposed, [name]);
    if (pilot.review) {
      await pilot.review(name);
      if (recording) await pause(6000);
      assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab.input.modified.scheme, 'forgepilot-diff');
      await pilot.acceptHunk(name, 0);
      await pilot.applySelected();
      evidence.push('PASS: Opened the native diff and applied an individually accepted hunk.');
    } else await pilot.apply();
    assert.match(doc.getText(), /["']off["']/i);
    assert.match(doc.getText(), /["']disabled["']/i);
    await doc.save();
    assert.notEqual(checksum(), before);
    evidence.push('PASS: A genuine model proposed the selected Flask change and VS Code applied it after review.');
    if (process.env.FORGEPILOT_PYTHON) {
      const result = execFileSync(process.env.FORGEPILOT_PYTHON, [join(__dirname, '../scripts/verify-debug.py')], {
        cwd: root, encoding: 'utf8', env: { ...process.env, PYTHONPATH: join(root, 'src') },
      });
      evidence.push(result.trim());
      if (recording) {
        const output = vscode.window.createOutputChannel('ForgePilot Task A checks');
        output.appendLine(result.trim());
        output.show(true);
        await pause(6500);
      }
    }
    await pilot.undo();
    await doc.save();
    assert.equal(checksum(), before);
    assert.equal(gitStatus(), status);
    evidence.push('PASS: ForgePilot undo restored the original helper and Git status.');
  } catch (error) {
    evidence.push('FAIL: ' + error.stack, JSON.stringify(pilot.state(), null, 2));
    throw error;
  } finally {
    if (process.env.FORGEPILOT_EVIDENCE) writeFileSync(process.env.FORGEPILOT_EVIDENCE, evidence.join('\n') + '\n');
    for (const line of evidence) console.log(line);
  }
};
