# ForgePilot AI demo recording script

The edited video `ForgePilot_Demo.mp4` is silent and uses real VS Code recordings and verified results. It runs approximately 3:29 and includes an embedded English caption track.

| Time | Edited video |
| --- | --- |
| 0:00 | Project and official Flask checkout |
| 0:15 | Local TrueForge runtime and workspace tools |
| 0:34 | Task A live edit, diff, approval and checks |
| 1:20 | Task B request, actual discovery and failed candidate verification |
| 2:30 | Task C connection failure and recovery |
| 2:57 | Review, cancellation and verification |
| 3:15 | Final outcomes |

The manual recording script below describes the intended Task B success path. The edited video shows the actual CLI verification result.

Target **3:58**. Record genuine actions and outputs. If a long turn requires a cut, keep the prompt, real tool activity and final result visible and label the elapsed-time cut. Use the exact model you declare. The workspace includes shortened VS Code clips for Task A and Task C, recorded during genuine runs.

## 0:00–0:15 · Open

**Say** “ForgePilot AI is a VS Code extension that uses TrueForge to inspect Flask, propose changes and let the developer review what gets applied.”

**Show** Open the ForgePilot Activity Bar view with the official Flask checkout and the commit visible.

## 0:15–0:35 · Local runtime

**Say** “TrueForge runs on localhost and owns the model session and tool calls. The extension gives it scoped workspace tools and keeps proposed changes in staging.”

**Show** The TrueForge terminal bound to loopback, the configured model ID without secrets, and the ForgePilot sidebar.

## 0:35–1:15 · Task A

**Say** “This is Flask’s original debug flag function. I’m asking ForgePilot to recognize off and disabled as false, irrespective of case.”

**Do** Select the entire `get_debug_flag` function in `src/flask/helpers.py`. Run **ForgePilot: Inline Edit** and enter “Treat off and disabled as additional case-insensitive false values. Preserve existing behavior.” Open **View diff**, accept the hunk, select **Apply accepted**, and save the helper.

**Show** The native diff before application and the actual result from the following command run from the ForgePilot project root.

```bash
PYTHONPATH="$PWD/demo-workspaces/flask-a/src" /tmp/forgepilot-demo/bin/python scripts/verify-debug.py
```

**Say** “The verification covers unset and existing values, the two new values in both cases, and values that should still enable debug mode.”

## 1:15–2:40 · Task B

**Say** “From a clean Flask checkout I’ll give ForgePilot a feature request without naming any files.”

**Do** Open Flask B in VS Code and submit this in Agent Mode.

> Implement a new built-in Flask CLI command named flask config that displays the loaded application's configuration as valid JSON, recursively masks sensitive keys and handles unsupported values safely. Add automated tests and update the documentation.

**Show** Search, reads, and staged modifications to implementation, tests, and documentation. Open the diffs, accept the reviewed changes, and save. Run the following from the ForgePilot project root.

```bash
PYTHONPATH="$PWD/demo-workspaces/flask-b/src" /tmp/forgepilot-demo/bin/python -m flask --app "$PWD/submission/flask_demo_app.py" config
PYTHONPATH="$PWD/demo-workspaces/flask-b/src" /tmp/forgepilot-demo/bin/python scripts/verify-config.py
PYTHONPATH="$PWD/demo-workspaces/flask-b/src" /tmp/forgepilot-demo/bin/python -m pytest -q demo-workspaces/flask-b/tests/test_cli.py
```

**Say** “The command displays normal values in JSON and conceals the dummy secret, password, token and API credential. This is the test exit result.”

## 2:40–3:25 · Task C

**Say** “I’ll point a disposable TrueForge provider at an unused loopback port. The editor should stay responsive and no files should change.”

**Do** In the Flask checkout terminal, capture `git status --porcelain` and `sha256sum src/flask/helpers.py`. From the ForgePilot root, register the provider with `node scripts/local-provider.cjs forgepilot-unavailable 18881 unavailable-model`. Set **ForgePilot: Model** to `forgepilot-unavailable/coding-model`. Submit “Inspect Flask CLI configuration and report what you find.” Show the real connection error and rerun the checks. Restore the good model ID and send the same request.

**Show** Failed state, unchanged status and checksum, and a genuine successful recovery.

## 3:25–3:58 · Close

**Say** “ContextLens shows the code sent to TrueForge. ForgePilot stages changes for hunk review and maintains an undo transaction. The run log shows the real checks and their results. ForgePilot AI. Understand. Engineer. Verify.”

**Show** ContextLens, Activity, the review panel and the output from the real verification run.
