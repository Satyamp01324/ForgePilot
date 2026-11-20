# Verification record

| Check | Result |
| --- | --- |
| TypeScript build | Passed |
| Offline tests | 9 passed |
| Extension Development Host | VS Code 1.147.0 activated ForgePilot and registered the three contributed commands |
| TrueForge local server | 0.185.1 in standalone mode on 127.0.0.1:8790 |
| MCP discovery | TrueForge listed the run-scoped `stage_selection` tool |
| TrueForge model stream and invocation | Passed in the Extension Development Host. Qwen2.5-3B-Instruct Q4_K_M streamed a response and invoked `stage_selection` through TrueForge |
| Flask baseline | Checkout 49943b5a94413a530761350f04e896f76e8d620e. Targeted helper and CLI suites, 93 passed |
| Task A | Live proposed edit opened in the native diff. One explicitly accepted hunk applied. All 17 debug flag cases passed. Undo restored the original Flask helper and Git status |
| Task B | Partial. Qwen3-4B discovered implementation, tests and docs through TrueForge. A focused retry, prompted with symbol hints and no file paths, staged executable CLI code. A real run in a temporary copy exited 1 with `TypeError: Object of type timedelta is not JSON serializable`. The candidate also lacked recursive masking. The proposal was withheld from the Flask checkout. |
| Task C | A real, refused model endpoint produced `ECONNREFUSED`. Git status and all tracked-file checksums matched. A subsequent valid TrueForge turn completed Task A |
| Live cancellation | Stop cleared the extension immediately, TrueForge reported the turn cancelled, and tracked checkout contents matched |
| Production dependency audit | npm reported zero known vulnerabilities at verification time |
| VSIX | Package integrity verified with unzip. Installed and listed in a separate VS Code profile |
| Agent-triggered pytest | Disabled on the cloud host because bubblewrap could not start its isolated network namespace |

The workspace contains genuine, shortened VS Code recordings of Tasks A and C. The edited demo combines those clips with recorded Task B discovery and the temporary-checkout verification result.

**Final acceptance** 26 of 27 items verified (96%). The open item is Task B end-to-end verification. Public links and portal upload remain pending.
