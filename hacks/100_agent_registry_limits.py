from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Subagent registry limits")
    registry = read_text("codex-rs/core/src/agent/registry.rs")
    markers = [
        "struct AgentRegistry",
        "reserve_spawn_slot",
        "next_thread_spawn_depth",
        "exceeds_thread_spawn_depth_limit",
    ]
    all_markers_present = True

    for marker in markers:
        present = marker in registry
        print(f"{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present

    parent_depth = 2
    next_depth = parent_depth + 1
    max_depth = 2
    print(
        "example depth/thread limit: "
        f"parent_depth={parent_depth} -> next_depth={next_depth}, max_depth={max_depth}, "
        f"exceeds={str(next_depth > max_depth).lower()}"
    )
    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
