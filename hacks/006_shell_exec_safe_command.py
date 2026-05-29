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
    all_markers_present = True

    for path, marker in marker_pairs:
        text = canonicalization if "command_canonicalization" in path else runtime
        present = marker in text
        print(f"{path}:{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present
    print(
        "exec path: command args -> canonicalization -> approval key -> sandbox attempt -> run"
    )
    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
