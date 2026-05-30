from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_explorer_uses_technical_map_shell() -> None:
    app = read("explorer/src/App.tsx")
    css = read("explorer/src/index.css")

    assert "technical-map-shell" in app
    assert "Architecture Map" in app
    assert "observatory" not in app.lower()
    assert "--surface-page" in css
    assert "radial-gradient" not in css


def test_graph_views_render_swimlanes() -> None:
    lifecycle = read("explorer/src/lifecycle/TurnLifecycleExplorer.tsx")
    subagents = read("explorer/src/subagents/SubagentsExplorer.tsx")
    css = read("explorer/src/index.css")

    assert "graph-swimlanes" in lifecycle
    assert "graph-swimlanes" in subagents
    assert "laneForLifecycleNode" in lifecycle
    assert "laneForSubagentNode" in subagents
    assert ".graph-lane" in css


def test_graph_views_control_edges_and_show_code_deep_dive() -> None:
    lifecycle = read("explorer/src/lifecycle/TurnLifecycleExplorer.tsx")
    subagents = read("explorer/src/subagents/SubagentsExplorer.tsx")
    css = read("explorer/src/index.css")

    assert "renderEdgeLabelBadge" in lifecycle
    assert "renderEdgeMarker" in subagents
    assert "graph-edge-label__bg" in css
    assert "deep-dive-panel" in lifecycle
    assert "deep-dive-panel" in subagents
    assert "sourceHref" in lifecycle
    assert "sourceHref" in subagents
    assert "CODEX_HACKERS_GUIDE.md" in lifecycle
    assert "CODEX_HACKERS_GUIDE.md" in subagents


def test_subagent_graph_uses_flow_lanes_and_relationship_strip() -> None:
    subagents = read("explorer/src/subagents/SubagentsExplorer.tsx")
    css = read("explorer/src/index.css")

    assert "Root thread" in subagents
    assert "Control plane" in subagents
    assert "Collaboration runtime" in subagents
    assert "Projection" in subagents
    assert "relationship-strip" in subagents
    assert "renderEdgeMarker" in subagents
    assert ".relationship-strip" in css
