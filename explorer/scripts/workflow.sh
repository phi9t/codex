#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
python3 explorer/scripts/build_component_manifest.py --repo-root .
python3 explorer/scripts/build_subagent_manifest.py --repo-root .
python3 -m pytest tests/hacks/test_hacks_smoke.py -q
cd explorer
npm run typecheck
npm run build
