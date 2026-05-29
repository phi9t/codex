from __future__ import annotations

import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def print_header(title: str) -> None:
    print(f"\n=== {title} ===")


def repo_path(relative: str) -> Path:
    path = ROOT / relative
    if not path.exists():
        raise FileNotFoundError(f"missing repo path: {relative}")
    return path


def read_text(relative: str) -> str:
    return repo_path(relative).read_text(encoding="utf-8")


def gated_skip(env_var: str) -> bool:
    if os.environ.get(env_var) == "1":
        return False
    print(f"SKIP: set {env_var}=1 to run this gated probe")
    return True
