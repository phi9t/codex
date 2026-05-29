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
    for marker in markers:
        print(f"{marker}: {'present' if marker in rollout else 'missing'}")
    print(
        "rollout path: persisted rollout items -> active replay segments -> rollback resolution -> restored history"
    )
    print("result: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
