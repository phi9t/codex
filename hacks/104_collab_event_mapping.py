from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Collab event mapping")
    mapping = read_text("codex-rs/app-server-protocol/src/protocol/event_mapping.rs")
    markers = [
        "EventMsg::CollabAgentSpawnBegin",
        "EventMsg::CollabAgentSpawnEnd",
        "EventMsg::CollabAgentInteractionBegin",
        "EventMsg::CollabAgentInteractionEnd",
        "EventMsg::CollabWaitingBegin",
        "EventMsg::CollabWaitingEnd",
        "CollabAgentTool::SpawnAgent",
        "CollabAgentTool::SendInput",
    ]
    all_markers_present = True

    for marker in markers:
        present = marker in mapping
        print(f"{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present

    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
