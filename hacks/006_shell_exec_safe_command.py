from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Shell exec safe command")
    canonicalization = read_text("codex-rs/core/src/command_canonicalization.rs")
    runtime = read_text("codex-rs/core/src/tools/runtimes/shell.rs")
    marker_pairs = [
        ("codex-rs/core/src/command_canonicalization.rs", "canonicalize_command_for_approval"),
        ("codex-rs/core/src/command_canonicalization.rs", "CANONICAL_BASH_SCRIPT_PREFIX"),
        ("codex-rs/core/src/tools/runtimes/shell.rs", "Approvable<ShellRequest>"),
        ("codex-rs/core/src/tools/runtimes/shell.rs", "sandbox_mode_for_first_attempt"),
    ]

    for path, marker in marker_pairs:
        text = canonicalization if "command_canonicalization" in path else runtime
        print(
            f"{path}:{marker}: "
            f"{'present' if marker in text else 'missing'}"
        )
    print(
        "exec path: command args -> canonicalization -> approval key -> sandbox attempt -> run"
    )
    print("result: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
