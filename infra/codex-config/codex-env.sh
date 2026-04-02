#!/usr/bin/env bash
# =============================================================================
# Quick environment setup for Codex with self-hosted inference
# =============================================================================
# Source this file, then run codex with --oss:
#
#   source codex-env.sh
#   codex --oss -m Qwen/Qwen2.5-Coder-7B-Instruct "explain this repo"
#
# Or for headless / exec mode:
#   codex exec --oss -m Qwen/Qwen2.5-Coder-7B-Instruct "list files"

# -- Option A: Dynamo frontend (full stack) --
export CODEX_OSS_BASE_URL="http://localhost:8080/v1"

# -- Option B: SGLang direct (standalone) --
# export CODEX_OSS_BASE_URL="http://localhost:30000/v1"

# -- For Kubernetes with port-forward --
# kubectl port-forward -n codex-inference svc/dynamo-frontend 8080:8080 &
# export CODEX_OSS_BASE_URL="http://localhost:8080/v1"
