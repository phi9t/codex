from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Apply patch fixture")
    handler = read_text("codex-rs/core/src/tools/handlers/apply_patch.rs")
    runtime = read_text("codex-rs/core/src/tools/runtimes/apply_patch.rs")
    markers = [
        ("codex-rs/core/src/tools/handlers/apply_patch.rs", "ApplyPatchHandler"),
        ("codex-rs/core/src/tools/handlers/apply_patch.rs", "ApplyPatchArgumentDiffConsumer"),
        ("codex-rs/core/src/tools/runtimes/apply_patch.rs", "ApplyPatchRuntime"),
        ("codex-rs/core/src/tools/runtimes/apply_patch.rs", "start_approval_async"),
    ]
    all_markers_present = True
    for path, marker in markers:
        text = handler if "handlers/apply_patch.rs" in path else runtime
        present = marker in text
        print(f"{path}:{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present
    print(
        "patch path: function call -> diff diff parser -> approval -> runtime apply -> event output"
    )
    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
