# Round 1 submission checklist

| Item | Value or evidence |
| --- | --- |
| Techfest Team ID | Enter the registered Team ID |
| Participants | Enter the registered names |
| Public GitHub URL | Add after authorized publication |
| Public demo video URL | Upload ForgePilot_Demo.mp4 and add its public URL |
| Technical PDF | ForgePilot_Technical_Report.pdf |
| Extension installer | ForgePilot-AI.vsix |
| Declared model | Qwen2.5-3B-Instruct Q4_K_M for the verified local run. Update this entry if the recording uses another model. |
| TrueForge integration | See VERIFICATION.md |
| Task A — inline edit | See VERIFICATION.md |
| Task B — CLI and multi-file agent | Partial. Real discovery and staging verified. CLI candidate failed serialization in a temporary copy. See VERIFICATION.md. |
| Task C — real failure and recovery | See VERIFICATION.md |
| Offline and VS Code activation | See VERIFICATION.md |

- [ ] Confirm upload deadline and any supplementary instructions in the team portal.
- [ ] Fill Team ID and participant names in the technical PDF.
- [ ] Confirm repository visibility and that it contains no credentials or demo working trees.
- [ ] Confirm the publicly accessible demo shows real executions and is at most four minutes.
- [ ] Submit the public repository and video links plus a 1–3 page technical PDF.
- [ ] Verify successful receipt in the portal.

After you authorize publication and authenticate GitHub CLI, publish from the ForgePilot project root.

```bash
gh repo create forgepilot-ai --public --source=. --remote=origin --push
```
