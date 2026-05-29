from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Tool dispatch matrix")
    router = read_text("codex-rs/core/src/tools/router.rs")
    markers = [
        "struct ToolRouter",
        "ToolCall",
        "tool_supports_parallel",
        "build_tool_call",
    ]
    all_markers_present = True
    for marker in markers:
        present = marker in router
        print(f"{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present
    print(
        "dispatch path: response function call -> ToolRouter -> ToolCall payload -> handler/runtime dispatch"
    )
    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
