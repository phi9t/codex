#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


HEADER_RE = re.compile(r"^##\s+(\d+)\.\s+(.+?)\s*$")
HACK_REF_RE = re.compile(r"`(hacks/(\d{3})_[A-Za-z0-9_]+\.py)`")
SOURCE_REF_RE = re.compile(r"`([^`]+?\.(?:rs|md|py)):(\d+)`")


def parse_sections(text: str) -> list[dict[str, str]]:
    sections = []
    for line in text.splitlines():
        match = HEADER_RE.match(line)
        if match:
            sections.append(
                {
                    "section": match.group(1),
                    "title": match.group(2),
                    "related_hacks": [],
                }
            )
    return sections


def parse_hacks(text: str) -> list[dict[str, object]]:
    hacks_by_script: dict[str, dict[str, object]] = {}
    for match in HACK_REF_RE.finditer(text):
        script = match.group(1)
        if script in hacks_by_script:
            continue

        hack_id = match.group(2)
        kind = "gated-live" if hack_id == "140" or hack_id.startswith("9") else "fixture"
        hacks_by_script[script] = {
            "id": hack_id,
            "script": script,
            "title": Path(script).stem[4:].replace("_", " "),
            "band": f"{hack_id[0]}00-{hack_id[0]}99",
            "kind": kind,
            "gated": hack_id == "140" or hack_id.startswith("9"),
            "command": f"python3 {script}",
            "desc": "",
            "expected_shape": "prints stable section labels and exits 0",
        }

    return sorted(hacks_by_script.values(), key=lambda hack: hack["id"])


def parse_source_refs(text: str) -> list[dict[str, int | str]]:
    return [
        {"file": match.group(1), "line": int(match.group(2))}
        for match in SOURCE_REF_RE.finditer(text)
    ]


def validate_source_refs(root: Path, source_refs: list[dict[str, int | str]]) -> list[str]:
    warnings = []
    for ref in source_refs:
        if not (root / str(ref["file"])).exists():
            warnings.append(f"missing source file: {ref['file']}")
    return sorted(set(warnings))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--guide", default="CODEX_HACKERS_GUIDE.md")
    parser.add_argument("--out", default="explorer/public/data/components.json")
    args = parser.parse_args()

    root = Path(args.repo_root).resolve()
    guide_path = root / args.guide
    guide = guide_path.read_text(encoding="utf-8")

    sections = parse_sections(guide)
    hacks = parse_hacks(guide)
    source_refs = parse_source_refs(guide)

    manifest = {
        "guide": args.guide,
        "families": ["lifecycle", "subagents", "subsystems", "hacks"],
        "nodes": [],
        "edges": [],
        "sections": sections,
        "hacks": hacks,
        "source_refs": source_refs,
        "warnings": validate_source_refs(root, source_refs),
    }

    out = root / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
