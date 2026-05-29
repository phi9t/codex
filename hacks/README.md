# hacks/

Runnable probes for `CODEX_HACKERS_GUIDE.md`.

These commands are documentation references for this plan; they become runnable once the probe harness and probe scripts are implemented in later tasks.

Run one probe:

```bash
python3 hacks/001_protocol_lifecycle.py
```

Run the smoke suite:

```bash
python3 -m pytest tests/hacks/test_hacks_smoke.py
```

| Band | Scope |
| --- | --- |
| 001-099 | Core turn lifecycle |
| 100-149 | Sub-agents and collaboration |
| 150-199 | App-server and external API |
| 200-249 | MCP, plugins, skills, hooks |
| 250-299 | Persistence, rollout, resume, rollback |
| 900-999 | Gated/live probes |
