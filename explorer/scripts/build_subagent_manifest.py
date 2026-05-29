#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


NODES = [
    {"id": "root-thread", "label": "Root thread", "group": "thread"},
    {"id": "agent-control", "label": "AgentControl", "group": "control", "file": "codex-rs/core/src/agent/control.rs"},
    {
        "id": "registry",
        "label": "AgentRegistry",
        "group": "control",
        "file": "codex-rs/core/src/agent/registry.rs",
    },
    {"id": "child-thread", "label": "Child thread", "group": "thread"},
    {
        "id": "mailbox",
        "label": "Mailbox",
        "group": "message",
        "file": "codex-rs/core/src/agent/mailbox.rs",
    },
    {
        "id": "event-mapping",
        "label": "Collab event mapping",
        "group": "protocol",
        "file": "codex-rs/app-server-protocol/src/protocol/event_mapping.rs",
    },
]

EDGES = [
    {"from": "root-thread", "to": "agent-control", "label": "spawn_agent", "kind": "call"},
    {"from": "agent-control", "to": "registry", "label": "reserve", "kind": "state"},
    {"from": "agent-control", "to": "child-thread", "label": "start", "kind": "spawn"},
    {"from": "root-thread", "to": "mailbox", "label": "send", "kind": "message"},
    {"from": "child-thread", "to": "event-mapping", "label": "status", "kind": "event"},
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--out", default="explorer/public/data/subagents.json")
    args = parser.parse_args()

    root = Path(args.repo_root).resolve()
    node_ids = {node["id"] for node in NODES}
    warnings = [
        f"missing source file: {node['file']}"
        for node in NODES
        if "file" in node and not (root / node["file"]).exists()
    ]

    for edge in EDGES:
        if edge["from"] not in node_ids:
            warnings.append(f"invalid edge source node id: {edge['from']}")
        if edge["to"] not in node_ids:
            warnings.append(f"invalid edge target node id: {edge['to']}")

    warnings = sorted(set(warnings))

    manifest = {"nodes": NODES, "edges": EDGES, "warnings": warnings}

    out = root / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
