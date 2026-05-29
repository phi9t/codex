from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Subagent resume tree")
    control = read_text("codex-rs/core/src/agent/control.rs")
    runtime = read_text("codex-rs/state/src/runtime/threads.rs")
    resume_handler = read_text("codex-rs/core/src/tools/handlers/multi_agents/resume_agent.rs")
    markers = [
        ("codex-rs/core/src/agent/control.rs", "resume_agent_from_rollout"),
        ("codex-rs/core/src/agent/control.rs", "resume_single_agent_from_rollout"),
        ("codex-rs/core/src/agent/control.rs", "live_thread_spawn_descendants"),
        ("codex-rs/core/src/agent/control.rs", "list_thread_spawn_children_with_status"),
        ("codex-rs/state/src/runtime/threads.rs", "list_thread_spawn_descendants_with_status"),
        ("codex-rs/core/src/tools/handlers/multi_agents/resume_agent.rs", "try_resume_closed_agent"),
    ]
    all_markers_present = True

    for path, marker in markers:
        source = control if "control.rs" in path else runtime if "runtime/threads.rs" in path else resume_handler
        present = marker in source
        print(f"{path}:{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present

    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
