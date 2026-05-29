from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Mailbox delivery")
    mailbox = read_text("codex-rs/core/src/agent/mailbox.rs")
    session = read_text("codex-rs/core/src/session/mod.rs")

    markers = [
        ("codex-rs/core/src/agent/mailbox.rs", "struct Mailbox"),
        ("codex-rs/core/src/agent/mailbox.rs", "MailboxReceiver"),
        ("codex-rs/core/src/agent/mailbox.rs", "fn send(&self, communication"),
        ("codex-rs/core/src/session/mod.rs", "defer_mailbox_delivery_to_next_turn"),
        ("codex-rs/core/src/session/mod.rs", "accept_mailbox_delivery_for_current_turn"),
        ("codex-rs/core/src/session/mod.rs", "has_trigger_turn_mailbox_items"),
        ("codex-rs/core/src/session/mod.rs", "enqueue_mailbox_communication"),
    ]
    all_markers_present = True

    for path, marker in markers:
        present = marker in (mailbox if "mailbox.rs" in path else session)
        print(f"{path}:{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present

    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
