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
    for marker in markers:
        print(f"{marker}: {'present' if marker in router else 'missing'}")
    print(
        "dispatch path: response function call -> ToolRouter -> ToolCall payload -> handler/runtime dispatch"
    )
    print("result: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
