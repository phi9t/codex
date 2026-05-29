#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


HEADER_RE = re.compile(r"^##\s+(\d+)\.\s+(.+?)\s*$")
SOURCE_REF_RE = re.compile(r"`([^`]+?\.(?:rs|md|py)):(\d+)`")
HACK_REF_RE = re.compile(r"`(hacks/(\d{3})_[A-Za-z0-9_]+\.py)`")
HACK_TABLE_ROW_RE = re.compile(
    r"^\|\s*(\d+)\s*\|\s*`(hacks/\d{3}_[^`]+\.py)`\s*\|\s*§(\d+)\s*\|\s*([A-Za-z-]+)\s*\|\s*.*\|\s*$"
)
ARCH_TABLE_ROW_RE = re.compile(
    r"^\|\s*([^|]+)\s*\|\s*`([^`]+?\.(?:rs|md|py)):(\d+)`\s*\|\s*`([^`]+)`\s*\|.*$"
)
MERMAID_EDGE_RE = re.compile(
    r"([A-Za-z0-9_]+)(?:\[([^]]+)\])?\s*-->\s*([A-Za-z0-9_]+)(?:\[([^]]+)\])?"
)


def parse_sections(text: str) -> list[dict]:
    lines = text.splitlines()
    sections = []
    current_section: dict | None = None
    body_lines: list[str] = []

    def finalize_section() -> None:
        if current_section is None:
            return
        current_section["body"] = "\n".join(body_lines)

    for line in lines:
        match = HEADER_RE.match(line)
        if not match:
            if current_section is not None:
                body_lines.append(line)
            continue

        finalize_section()
        current_section = {
            "section": match.group(1),
            "title": match.group(2),
            "related_hacks": [],
            "body": "",
        }
        sections.append(current_section)
        body_lines = []

    finalize_section()
    return sections


def parse_hack_table(text: str) -> dict[str, dict[str, str]]:
    table = {}
    for line in text.splitlines():
        match = HACK_TABLE_ROW_RE.match(line)
        if not match:
            continue

        script = match.group(2)
        hack_id = Path(script).stem.split("_", 1)[0]
        table[hack_id] = {
            "script": script,
            "section": match.group(3),
            "kind": match.group(4).lower(),
        }
    return table


def parse_source_refs(text: str) -> list[dict[str, int | str]]:
    refs = []
    for match in SOURCE_REF_RE.finditer(text):
        refs.append({"file": match.group(1), "line": int(match.group(2))})
    return refs


def validate_source_refs(
    root: Path, source_refs: list[dict[str, int | str]]
) -> list[str]:
    warnings: list[str] = []
    for ref in source_refs:
        path = root / str(ref["file"])
        line = int(ref["line"])
        if not path.exists():
            warnings.append(f"missing source file: {ref['file']}")
            continue

        line_count = len(path.read_text(encoding="utf-8").splitlines())
        if line < 1 or line > line_count:
            warnings.append(
                f"source reference out of range: {ref['file']}:{line} (file has {line_count} lines)"
            )

    return sorted(set(warnings))


def parse_arch_nodes_and_edges(sections: list[dict], source_refs: list[dict[str, int | str]]) -> tuple[list[dict], list[dict]]:
    arch_section = next((s for s in sections if s["section"] == "2"), None)
    if arch_section is None:
        return [], []

    body = arch_section["body"].splitlines()
    nodes_by_label = {}
    nodes = []
    section_source_lookup = {
        (ref["file"], int(ref["line"])): {"file": ref["file"], "line": int(ref["line"])}
        for ref in source_refs
    }

    def as_node_id(label: str) -> str:
        node_id = re.sub(r"[^a-z0-9]+", "-", label.lower())
        return node_id.strip("-")

    for line in body:
        row = ARCH_TABLE_ROW_RE.match(line)
        if not row:
            continue
        label = row.group(1).strip()
        file = row.group(2).strip()
        line_no = int(row.group(3))
        symbol = row.group(4).strip()
        node_id = as_node_id(label)

        if node_id in nodes_by_label:
            continue

        nodes_by_label[label] = node_id
        nodes.append(
            {
                "id": node_id,
                "label": label,
                "file": file,
                "line": line_no,
                "symbol": symbol,
                "section": arch_section["section"],
                "summary": label,
                "source_ref": section_source_lookup.get((file, line_no)),
            }
        )

    lines = [line for line in body if MERMAID_EDGE_RE.search(line)]
    edges = []
    seen_edges = set()

    mermaid_id_to_label: dict[str, str] = {}
    for line in lines:
        for match in MERMAID_EDGE_RE.finditer(line):
            if match.group(2):
                mermaid_id_to_label[match.group(1)] = match.group(2).strip()
            if match.group(4):
                mermaid_id_to_label[match.group(3)] = match.group(4).strip()

    def resolve_label(node_id: str, explicit: str | None) -> str:
        if explicit:
            return explicit.strip()
        return mermaid_id_to_label.get(node_id, node_id.replace("_", " "))

    for line in lines:
        match = MERMAID_EDGE_RE.search(line)
        if not match:
            continue

        from_label = resolve_label(match.group(1), match.group(2))
        to_label = resolve_label(match.group(3), match.group(4))
        if from_label not in nodes_by_label:
            nodes_by_label[from_label] = as_node_id(from_label)
            nodes.append(
                {
                    "id": nodes_by_label[from_label],
                    "label": from_label,
                    "section": arch_section["section"],
                    "summary": from_label,
                }
            )
        if to_label not in nodes_by_label:
            nodes_by_label[to_label] = as_node_id(to_label)
            nodes.append(
                {
                    "id": nodes_by_label[to_label],
                    "label": to_label,
                    "section": arch_section["section"],
                    "summary": to_label,
                }
            )

        from_id = nodes_by_label.get(from_label)
        to_id = nodes_by_label.get(to_label)
        if not from_id or not to_id:
            continue
        edge_key = (from_id, to_id)
        if edge_key in seen_edges:
            continue
        seen_edges.add(edge_key)
        edges.append(
            {
                "from": from_id,
                "to": to_id,
                "kind": "flow",
                "label": "lifecycle",
            }
        )

    return sorted(nodes, key=lambda n: n["id"]), edges


def build_sections(sections: list[dict], hack_table: dict[str, dict[str, str]], source_refs: list[dict[str, int | str]]) -> list[dict]:
    source_refs_by_section = {}
    for section in sections:
        section_body = section["body"]
        first_ref = SOURCE_REF_RE.search(section_body)
        if first_ref:
            source_refs_by_section[section["section"]] = {
                "file": first_ref.group(1),
                "line": int(first_ref.group(2)),
            }

    section_hacks: dict[str, list[str]] = {}
    for hack_id, info in hack_table.items():
        section_hacks.setdefault(info["section"], []).append(hack_id)

    enriched = []
    for section in sections:
        data = {
            "section": section["section"],
            "title": section["title"],
            "related_hacks": sorted(section_hacks.get(section["section"], [])),
        }
        first_source_ref = source_refs_by_section.get(section["section"])
        if first_source_ref is not None:
            data["first_source_ref"] = first_source_ref
        enriched.append(data)
    return enriched


def build_hacks(guide_text: str, hack_table: dict[str, dict[str, str]]) -> list[dict[str, object]]:
    hacks_by_id: dict[str, dict[str, object]] = {}
    for match in HACK_REF_RE.finditer(guide_text):
        script = match.group(1)
        hack_id = match.group(2)
        if hack_id in hacks_by_id:
            continue

        table_info = hack_table.get(hack_id)
        kind = table_info["kind"] if table_info and table_info.get("kind") else None
        if kind is None:
            kind = "gated-live" if hack_id == "140" or hack_id.startswith("9") else "fixture"

        hacks_by_id[hack_id] = {
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
    return sorted(hacks_by_id.values(), key=lambda item: item["id"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--guide", default="CODEX_HACKERS_GUIDE.md")
    parser.add_argument("--out", default="explorer/public/data/components.json")
    args = parser.parse_args()

    root = Path(args.repo_root).resolve()
    guide_path = root / args.guide
    guide_text = guide_path.read_text(encoding="utf-8")

    sections = parse_sections(guide_text)
    hack_table = parse_hack_table(guide_text)
    source_refs = parse_source_refs(guide_text)
    enriched_sections = build_sections(sections, hack_table, source_refs)
    nodes, edges = parse_arch_nodes_and_edges(sections, source_refs)
    hacks = build_hacks(guide_text, hack_table)

    manifest = {
        "guide": args.guide,
        "families": ["lifecycle", "subagents", "subsystems", "hacks"],
        "nodes": nodes,
        "edges": edges,
        "sections": enriched_sections,
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
