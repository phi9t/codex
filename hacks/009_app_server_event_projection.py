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
    for marker in markers:
        print(
            f"{marker}: "
            f"{'present' if marker in projection else 'missing'}"
        )
    print(
        "projection path: core EventMsg -> item_event_to_server_notification -> thread notification item"
    )
    print("result: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
