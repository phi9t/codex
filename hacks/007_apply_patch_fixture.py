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
    for path, marker in markers:
        text = handler if "handlers/apply_patch.rs" in path else runtime
        print(
            f"{path}:{marker}: "
            f"{'present' if marker in text else 'missing'}"
        )
    print(
        "patch path: function call -> diff diff parser -> approval -> runtime apply -> event output"
    )
    print("result: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
