# Start here

1. From the ForgePilot repository, run `npm ci`, `npm test`, and `npm run package`. Install with `code --install-extension submission/ForgePilot-AI.vsix`. For development, compile and press F5.
2. Start local TrueForge in another terminal.

   ```bash
   HOST=127.0.0.1 OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1"]' npx --yes @truefoundry/trueforge@0.185.1 --port 8790
   ```

3. Open `http://127.0.0.1:8790`. Under **Settings → Models**, configure your existing provider key. In VS Code settings, set **ForgePilot: Model** to the full TrueForge model ID. For a local OpenAI-compatible endpoint on loopback port 8080, use `node scripts/local-provider.cjs forgepilot-local 8080 YOUR_UPSTREAM_MODEL_ID` and set `forgepilot-local/coding-model`. Follow the [credential-free model setup](README.md#reproduce-the-credential-free-verification-model) to reproduce the verified local model and port.
4. Prepare two clean Flask copies. The public brief did not specify a commit. These commands use the revision checked during preparation.

   ```bash
   mkdir -p demo-workspaces
   git clone https://github.com/pallets/flask demo-workspaces/flask-a
   git -C demo-workspaces/flask-a checkout --detach 49943b5a94413a530761350f04e896f76e8d620e
   git clone demo-workspaces/flask-a demo-workspaces/flask-b
   git -C demo-workspaces/flask-b checkout --detach 49943b5a94413a530761350f04e896f76e8d620e
   python3 -m venv /tmp/forgepilot-demo
   /tmp/forgepilot-demo/bin/python -m pip install pytest python-dotenv asgiref -e demo-workspaces/flask-a
   ```

5. Open `flask-a` in VS Code and follow the inline edit sequence. Open clean `flask-b` for Agent Mode, then demonstrate a genuine endpoint failure and recovery.
6. Use the [timed script](submission/DEMO_SCRIPT.md). Record the actual VS Code and terminal screens. Keep credentials and private settings off camera. The video must be four minutes or less.
7. Fill in the Team ID and names in the technical write-up, publish the approved repository and video, and submit them with the PDF. Use the [submission checklist](submission/SUBMISSION_CHECKLIST.md) to match the team portal.
