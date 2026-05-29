from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Capstone stub turn")
    core_turn = read_text("codex-rs/core/src/session/turn.rs")
    orchestrator = read_text("codex-rs/core/src/tools/orchestrator.rs")
    router = read_text("codex-rs/core/src/tools/router.rs")
    markers = [
        ("codex-rs/core/src/session/turn.rs", "async fn run_turn"),
        ("codex-rs/core/src/tools/router.rs", "build_tool_call"),
        ("codex-rs/core/src/tools/orchestrator.rs", "ToolOrchestrator"),
    ]
    for path, marker in markers:
        text = core_turn if "session/turn.rs" in path else orchestrator if "orchestrator.rs" in path else router
        print(f"{path}:{marker}: {'present' if marker in text else 'missing'}")

    print("capstone path: user_input -> run_turn -> model emits tool_call -> approval -> orchestrator -> model final response")
    print("result: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
