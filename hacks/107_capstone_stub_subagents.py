from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Capstone stub subagents")
    control = read_text("codex-rs/core/src/agent/control.rs")
    spawn_handler = read_text("codex-rs/core/src/tools/handlers/multi_agents/spawn.rs")

    markers = [
        ("codex-rs/core/src/agent/control.rs", "spawn_agent_with_metadata"),
        ("codex-rs/core/src/agent/control.rs", "close_agent"),
        ("codex-rs/core/src/tools/handlers/multi_agents/spawn.rs", "CollabAgentSpawnBegin"),
        ("codex-rs/core/src/tools/handlers/multi_agents/spawn.rs", "CollabAgentSpawnEnd"),
    ]
    all_markers_present = True
    for path, marker in markers:
        source = control if "agent/control.rs" in path else spawn_handler
        present = marker in source
        print(f"{path}:{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present

    print("root spawn worker")
    print("registry reserve slot")
    print("worker running")
    print("root send task")
    print("root wait")
    print("worker completed")
    print("root close worker")
    print("registry release slot")

    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
