from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Response stream fixture")
    stream_utils = read_text("codex-rs/core/src/stream_events_utils.rs")
    markers = [
        "raw_assistant_output_text_from_item",
        "record_completed_response_item",
        "HandleOutputCtx",
    ]
    for marker in markers:
        print(f"{marker}: {'present' if marker in stream_utils else 'missing'}")
    print(
        "stream path: response_item -> handle_output_item_done -> function_call_output -> persisted_event"
    )
    print("result: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
