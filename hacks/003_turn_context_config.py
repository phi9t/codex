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
    for marker in markers:
        print(f"{marker}: {'present' if marker in turn_context else 'missing'}")
    print(
        "turn context path: user input -> turn policy + environments -> model capabilities -> runtime config"
    )
    print("result: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
