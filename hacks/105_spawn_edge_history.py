from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Spawn edge history")
    graph = read_text("codex-rs/state/src/model/graph.rs")
    runtime = read_text("codex-rs/state/src/runtime/threads.rs")

    marker_pairs = [
        ("codex-rs/state/src/model/graph.rs", "DirectionalThreadSpawnEdgeStatus"),
        ("codex-rs/state/src/runtime/threads.rs", "upsert_thread_spawn_edge"),
        ("codex-rs/state/src/runtime/threads.rs", "set_thread_spawn_edge_status"),
        ("codex-rs/state/src/runtime/threads.rs", "list_thread_spawn_children_with_status"),
        ("codex-rs/state/src/runtime/threads.rs", "list_thread_spawn_descendants_with_status"),
        ("codex-rs/state/src/runtime/threads.rs", "find_thread_spawn_descendant_by_path"),
    ]
    all_markers_present = True

    for path, marker in marker_pairs:
        source = graph if "graph.rs" in path else runtime
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
