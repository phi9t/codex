from __future__ import annotations

from _utils import print_header, read_text


def main() -> int:
    print_header("Subagent role resolution")
    role = read_text("codex-rs/core/src/agent/role.rs")
    markers = [
        "DEFAULT_ROLE_NAME",
        "apply_role_to_config",
        "resolve_role_config",
        "load_role_layer_toml",
        "apply_role_to_config_inner",
        "preservation_policy",
    ]
    all_markers_present = True

    for marker in markers:
        present = marker in role
        print(f"{marker}: {'present' if present else 'missing'}")
        all_markers_present &= present

    if all_markers_present:
        print("result: ok")
        return 0

    print("result: missing markers")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
