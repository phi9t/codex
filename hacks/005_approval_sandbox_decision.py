from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Approval sandbox decision")
    sources = [
        ("codex-rs/core/src/tools/network_approval.rs", "NetworkApprovalMode"),
        ("codex-rs/core/src/tools/network_approval.rs", "allows_network_approval_flow"),
        ("codex-rs/core/src/network_policy_decision.rs", "network_approval_context_from_payload"),
        ("codex-rs/core/src/network_policy_decision.rs", "denied_network_policy_message"),
    ]
    all_markers_present = True

    for path, marker in sources:
        text = read_text(path)
        present = marker in text
        print(f"{path}:{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present
    print(
        "approval path: request tool -> approval policy -> network policy check -> decision result"
    )
    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
