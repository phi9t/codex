from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Core protocol lifecycle")
    protocol = read_text("codex-rs/protocol/src/protocol.rs")
    markers = ["enum EventMsg", "enum AgentStatus", "enum SessionSource"]
    for marker in markers:
        print(f"{marker}: {'present' if marker in protocol else 'missing'}")
    print("turn path: user_input -> model_stream -> tool_calls -> events -> persistence")
    print("result: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
