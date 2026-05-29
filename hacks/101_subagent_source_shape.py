from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Subagent source shape")
    protocol = read_text("codex-rs/protocol/src/protocol.rs")
    markers = [
        "enum SessionSource",
        "enum SubAgentSource",
        "ThreadSpawn",
        "get_nickname",
        "get_agent_path",
        "get_agent_role",
        "parent_thread_id",
        "agent_path",
        "agent_nickname",
        "agent_role",
    ]
    all_markers_present = True

    for marker in markers:
        present = marker in protocol
        print(f"{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present

    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
