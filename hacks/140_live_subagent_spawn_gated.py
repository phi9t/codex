from __future__ import annotations

from _utils import gated_skip, print_header


def main() -> int:
    print_header("Live subagent spawn (gated)")
    if gated_skip("CODEX_HACK_RUN_LIVE"):
        print("result: ok (skipped)")
        return 0

    print("live path: placeholder for live subagent spawn execution")
    print("result: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
