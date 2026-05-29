from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Turn context config")
    turn_context = read_text("codex-rs/core/src/session/turn_context.rs")
    markers = [
        "struct TurnContext",
        "approval_policy",
        "SessionSource",
    ]
    all_markers_present = True
    for marker in markers:
        present = marker in turn_context
        print(f"{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present
    print(
        "turn context path: user input -> turn policy + environments -> model capabilities -> runtime config"
    )
    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
