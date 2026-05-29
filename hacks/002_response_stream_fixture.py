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
    all_markers_present = True
    for marker in markers:
        present = marker in stream_utils
        print(f"{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present
    print(
        "stream path: response_item -> handle_output_item_done -> function_call_output -> persisted_event"
    )
    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
