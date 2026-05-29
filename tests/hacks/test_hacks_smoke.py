from __future__ import annotations

import os
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
HACKS_DIR = ROOT / "hacks"
TIMEOUT_S = 30
GATED = {"140_live_subagent_spawn_gated.py"}


def _scripts() -> list[Path]:
    return sorted(p for p in HACKS_DIR.glob("[0-9][0-9][0-9]_*.py") if p.is_file())


@pytest.mark.parametrize("script", _scripts(), ids=lambda p: p.name)
def test_hack_runs(script: Path) -> None:
    if script.name in GATED and os.environ.get("CODEX_HACK_RUN_LIVE") != "1":
        pytest.skip(f"{script.name} requires CODEX_HACK_RUN_LIVE=1")

    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=TIMEOUT_S,
    )
    assert result.returncode == 0, (
        f"\n--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}"
    )


def test_explorer_manifest_has_lifecycle_edges() -> None:
    with tempfile.NamedTemporaryFile(suffix=".json") as manifest_file:
        result = subprocess.run(
            [
                sys.executable,
                "explorer/scripts/build_component_manifest.py",
                "--repo-root",
                str(ROOT),
                "--out",
                manifest_file.name,
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_S,
        )
        assert result.returncode == 0, (
            f"\n--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}"
        )

        manifest = json.loads(Path(manifest_file.name).read_text(encoding="utf-8"))

    assert manifest["edges"]
    assert not [
        warning
        for warning in manifest["warnings"]
        if warning.startswith("unknown mermaid endpoint:")
    ]


def test_explorer_manifest_covers_hack_catalog() -> None:
    with tempfile.NamedTemporaryFile(suffix=".json") as manifest_file:
        result = subprocess.run(
            [
                sys.executable,
                "explorer/scripts/build_component_manifest.py",
                "--repo-root",
                str(ROOT),
                "--out",
                manifest_file.name,
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_S,
        )
        assert result.returncode == 0, (
            f"\n--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}"
        )

        manifest = json.loads(Path(manifest_file.name).read_text(encoding="utf-8"))

    manifest_scripts = {hack["script"] for hack in manifest["hacks"]}
    catalog_scripts = {f"hacks/{script.name}" for script in _scripts()}
    assert manifest_scripts == catalog_scripts
