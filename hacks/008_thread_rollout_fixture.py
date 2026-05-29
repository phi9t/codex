from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Thread rollout fixture")
    rollout = read_text("codex-rs/core/src/session/rollout_reconstruction.rs")
    markers = [
        "struct RolloutReconstruction",
        "reconstruct_history_from_rollout",
        "TurnReferenceContextItem",
        "finalize_active_segment",
    ]
    all_markers_present = True
    for marker in markers:
        present = marker in rollout
        print(f"{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present
    print(
        "rollout path: persisted rollout items -> active replay segments -> rollback resolution -> restored history"
    )
    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
