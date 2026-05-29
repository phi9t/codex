from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Core protocol lifecycle")
    protocol = read_text("codex-rs/protocol/src/protocol.rs")
    markers = ["enum EventMsg", "enum AgentStatus", "enum SessionSource"]
    all_markers_present = True
    for marker in markers:
        present = marker in protocol
        print(f"{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present
    print("turn path: user_input -> model_stream -> tool_calls -> events -> persistence")
    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
