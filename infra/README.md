# Self-Hosted Inference for Codex (Dynamo + SGLang)

Containerized infrastructure for serving open-source models to Codex CLI using
NVIDIA Dynamo (cluster orchestration) and SGLang (inference runtime).

## Architecture

```text
Codex CLI ──> Edge / Auth
                  │
                  ├── /v1/chat/completions  (wire_api = "chat")
                  └── /v1/responses         (wire_api = "responses", if supported)
                  │
              Dynamo Frontend (protocol normalization, request queueing)
                  │
              Dynamo Router (KV-aware routing, load balancing)
                  │
          ┌───────┼───────┐
          │       │       │
     SGLang    SGLang   SGLang
     Worker    Worker   Worker
      (GPU)    (GPU)    (GPU)
          │       │       │
     RadixAttention / HiCache / Continuous Batching
                  │
              NATS JetStream (KV events, load metrics, router sync)
              etcd (service discovery — local dev only)
```

## Prerequisites

- NVIDIA GPU(s) with driver >= 535
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) installed
- `nvidia-smi` works from the host
- Docker Engine >= 24.0 with Compose V2
- For Kubernetes: a cluster with GPU nodes and the `nvidia.com/gpu` resource available

### VRAM Requirements (approximate, FP16)

| Model | Parameters | Min VRAM |
|-------|-----------|----------|
| Qwen2.5-Coder-7B-Instruct | 7B | ~16 GB |
| Qwen2.5-Coder-14B-Instruct | 14B | ~32 GB |
| Qwen2.5-Coder-32B-Instruct | 32B | ~48 GB (2x GPU with TP=2) |
| DeepSeek-Coder-V2-Lite-Instruct | 16B | ~24 GB |

## Quick Start: Docker Compose

### Option A: SGLang Standalone (simplest)

Single SGLang server, no Dynamo infrastructure. Good for local dev with one GPU.

```bash
cd infra/docker-compose
cp .env.example .env
# Edit .env: set MODEL_NAME and HF_TOKEN (if gated model)

docker compose -f docker-compose.sglang-only.yml up -d

# Wait for model to load (check logs):
docker compose -f docker-compose.sglang-only.yml logs -f sglang

# Test:
curl http://localhost:30000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-Coder-7B-Instruct",
    "messages": [{"role": "user", "content": "Hello, write a Python hello world"}],
    "stream": true
  }'
```

Connect Codex:

```bash
CODEX_OSS_BASE_URL=http://localhost:30000/v1 codex --oss -m Qwen/Qwen2.5-Coder-7B-Instruct
```

### Option B: Full Dynamo Stack

Dynamo frontend + router + SGLang worker + NATS + etcd. Adds KV-aware routing,
request queueing, and multi-worker support.

```bash
cd infra/docker-compose
cp .env.example .env

docker compose up -d

# Wait for all services to be healthy:
docker compose ps

# Test:
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-Coder-7B-Instruct",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

Connect Codex:

```bash
CODEX_OSS_BASE_URL=http://localhost:8080/v1 codex --oss -m Qwen/Qwen2.5-Coder-7B-Instruct
```

### Option C: Disaggregated Prefill/Decode

Separates prefill and decode onto different GPU workers. Requires 2+ GPUs.
Better TTFT/ITL under high concurrency.

```bash
docker compose -f docker-compose.yml -f docker-compose.disagg.yml up -d
```

## Quick Start: Kubernetes

```bash
# Create namespace and shared config
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml

# Optional: create HuggingFace token secret
kubectl create secret generic hf-credentials \
  -n codex-inference \
  --from-literal=token=YOUR_HF_TOKEN

# Deploy infrastructure and workers
kubectl apply -f infra/k8s/nats/
kubectl apply -f infra/k8s/sglang/
kubectl apply -f infra/k8s/dynamo/

# Wait for workers to load the model
kubectl -n codex-inference get pods -w

# Port-forward to access locally
kubectl port-forward -n codex-inference svc/dynamo-frontend 8080:8080

# Connect Codex
CODEX_OSS_BASE_URL=http://localhost:8080/v1 codex --oss -m Qwen/Qwen2.5-Coder-7B-Instruct
```

## Connecting Codex CLI

Three ways to point Codex at your self-hosted inference:

### Method 1: Environment variable (quickest)

```bash
export CODEX_OSS_BASE_URL=http://localhost:8080/v1   # Dynamo
# or
export CODEX_OSS_BASE_URL=http://localhost:30000/v1  # SGLang direct

codex --oss -m Qwen/Qwen2.5-Coder-7B-Instruct
```

### Method 2: config.toml custom provider (recommended)

Copy `codex-config/config.toml.example` to `~/.codex/config.toml` and uncomment
the desired `model_provider` line. Then run `codex` normally (no `--oss` needed).

### Method 3: Shell helper

```bash
source infra/codex-config/codex-env.sh
codex --oss -m Qwen/Qwen2.5-Coder-7B-Instruct
```

## Wire API

Codex supports two wire protocols:

- **`chat`** (default for custom providers) -- hits `/v1/chat/completions`. SGLang
  fully supports this. This is the safe default.
- **`responses`** -- hits `/v1/responses`. SGLang has partial support (limited tool
  support). Use only if your Dynamo/SGLang version fully supports it.

Set `wire_api = "responses"` in your config.toml provider definition to switch.

## Changing the Model

1. Edit `MODEL_NAME` in `.env` (Docker Compose) or the ConfigMap (Kubernetes).
2. Restart the SGLang worker(s).
3. Update the `-m` flag in your Codex command to match.

## Scaling Workers (Kubernetes)

```bash
# Scale to 3 SGLang workers
kubectl -n codex-inference scale statefulset sglang-worker --replicas=3

# Scale Dynamo frontend replicas
kubectl -n codex-inference scale deployment dynamo-frontend --replicas=3
```

## Troubleshooting

**GPU not detected in container:**
Verify `nvidia-smi` works on the host and the NVIDIA Container Toolkit is
installed. Run `docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi`.

**OOM during model loading:**
Reduce `SGLANG_MEM_FRACTION` (e.g., 0.80) or use a smaller model. Check that
`TENSOR_PARALLEL_SIZE` matches available GPUs.

**SGLang health check failing:**
Model loading can take 2-10 minutes depending on model size and disk speed.
Check logs: `docker compose logs -f sglang-worker` or `kubectl -n codex-inference logs -f statefulset/sglang-worker`.

**Codex returns "connection refused":**
Ensure the server is healthy and the port matches your `CODEX_OSS_BASE_URL`.
Test with `curl http://localhost:<port>/v1/chat/completions`.

**Streaming not working:**
Ensure `"stream": true` is in your request. Codex sends streaming requests by
default. Check that no reverse proxy is buffering SSE responses.

## File Structure

```
infra/
  README.md                              # This file
  docker-compose/
    .env.example                         # Environment variable template
    docker-compose.sglang-only.yml       # SGLang standalone (simplest)
    docker-compose.yml                   # Full Dynamo + SGLang stack
    docker-compose.disagg.yml            # PD disaggregation override
  k8s/
    namespace.yaml                       # codex-inference namespace
    configmap.yaml                       # Shared configuration
    nats/
      statefulset.yaml                   # NATS + JetStream
      service.yaml                       # NATS services
    sglang/
      statefulset.yaml                   # SGLang GPU workers
      service.yaml                       # SGLang services
    dynamo/
      deployment.yaml                    # Dynamo frontend
      service.yaml                       # Dynamo service
  codex-config/
    config.toml.example                  # Codex CLI provider config
    codex-env.sh                         # Shell env helper
```
