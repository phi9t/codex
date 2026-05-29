from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("App server event projection")
    projection = read_text("codex-rs/app-server-protocol/src/protocol/event_mapping.rs")
    markers = [
        "item_event_to_server_notification",
        "EventMsg::DynamicToolCallResponse",
        "ServerNotification::ItemCompleted",
        "ThreadItem::DynamicToolCall",
    ]
    all_markers_present = True
    for marker in markers:
        present = marker in projection
        print(f"{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present
    print(
        "projection path: core EventMsg -> item_event_to_server_notification -> thread notification item"
    )
    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
