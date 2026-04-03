# Self-Hosted Inference for Codex (Dynamo + SGLang)

Serve open-source models to Codex CLI using NVIDIA Dynamo (cluster orchestration)
and SGLang (inference runtime).

## Architecture

```text
Codex CLI ──> /v1/chat/completions (wire_api = "chat")
                  │
              Dynamo Frontend (request queueing, protocol handling)
                  │
              Dynamo Router (KV-aware routing, load balancing)
                  │
          ┌───────┼───────┐
          │       │       │
     SGLang    SGLang   SGLang       ← GPU workers with RadixAttention,
     Worker    Worker   Worker         HiCache, priority scheduling
                  │
              NATS JetStream (KV events, load metrics)
              etcd (service discovery)
```

## Prerequisites

- NVIDIA GPU(s) with driver >= 535
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
- Docker Engine >= 24.0 with Compose V2
- For Kubernetes: GPU nodes with `nvidia.com/gpu` resource available
- For full Dynamo stack: [NGC account](https://ngc.nvidia.com/) for pulling `nvcr.io` images

### VRAM Requirements (FP16)

| Model | Min VRAM |
|-------|----------|
| Qwen2.5-Coder-7B-Instruct | ~16 GB |
| Qwen2.5-Coder-14B-Instruct | ~32 GB |
| Qwen2.5-Coder-32B-Instruct | ~48 GB (TP=2) |

## Quick Start: Docker Compose

### Option A: SGLang standalone (simplest, no NGC account needed)

```bash
cd infra/docker-compose
cp .env.example .env
# Edit .env: set MODEL_NAME and HF_TOKEN if needed

docker compose -f docker-compose.sglang-only.yml up -d
docker compose -f docker-compose.sglang-only.yml logs -f sglang  # wait for "server is ready"

# Connect Codex:
CODEX_OSS_BASE_URL=http://localhost:30000/v1 codex --oss -m Qwen/Qwen2.5-Coder-7B-Instruct
```

### Option B: Full Dynamo stack

Adds KV-aware routing, request queueing, and multi-worker support.
Requires NGC credentials: `docker login nvcr.io`.

```bash
cd infra/docker-compose
cp .env.example .env
docker compose up -d
docker compose ps  # wait for all services healthy

# Connect Codex:
CODEX_OSS_BASE_URL=http://localhost:8080/v1 codex --oss -m Qwen/Qwen2.5-Coder-7B-Instruct
```

### Option C: Disaggregated prefill/decode (2+ GPUs)

```bash
docker compose -f docker-compose.yml -f docker-compose.disagg.yml up -d
```

## Quick Start: Kubernetes

All manifests use native K8s constructs (Namespace, ConfigMap, StatefulSet,
Deployment, Service). No CRDs or operators required.

```bash
# 1. Namespace and config
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml

# 2. Optional: HuggingFace token for gated models
kubectl create secret generic hf-credentials \
  -n codex-inference --from-literal=token=YOUR_HF_TOKEN

# 3. Optional: NGC image pull secret for Dynamo image
kubectl create secret docker-registry ngc-secret \
  -n codex-inference \
  --docker-server=nvcr.io \
  --docker-username='$oauthtoken' \
  --docker-password=YOUR_NGC_API_KEY

# 4. Deploy (order matters: infra first, then workers, then frontend)
kubectl apply -f infra/k8s/etcd/
kubectl apply -f infra/k8s/nats/
kubectl apply -f infra/k8s/sglang/
kubectl apply -f infra/k8s/dynamo/

# 5. Wait for model to load
kubectl -n codex-inference get pods -w

# 6. Access
kubectl port-forward -n codex-inference svc/dynamo-frontend 8080:8080
CODEX_OSS_BASE_URL=http://localhost:8080/v1 codex --oss -m Qwen/Qwen2.5-Coder-7B-Instruct
```

## Connecting Codex CLI

**Environment variable** (quickest):

```bash
export CODEX_OSS_BASE_URL=http://localhost:8080/v1   # Dynamo
export CODEX_OSS_BASE_URL=http://localhost:30000/v1  # SGLang direct
codex --oss -m Qwen/Qwen2.5-Coder-7B-Instruct
```

**config.toml** (recommended): copy `codex-config/config.toml.example` to
`~/.codex/config.toml` and uncomment the desired `model_provider` line.

## Changing the Model

1. Set `MODEL_NAME` in `.env` (Docker Compose) or the ConfigMap (Kubernetes).
2. Restart SGLang worker(s).
3. Pass matching `-m` flag to Codex.

## Scaling (Kubernetes)

```bash
kubectl -n codex-inference scale statefulset sglang-worker --replicas=3
kubectl -n codex-inference scale deployment dynamo-frontend --replicas=3
```

## SGLang Worker Flags

All workers launch with agentic-optimized flags. These improve multi-turn
coding sessions where 85-97% of tokens are cached prefix after the first turn:

| Flag | Effect |
|------|--------|
| `--enable-priority-scheduling` | Interactive requests preempt background jobs |
| `--radix-eviction-policy priority` | Preserves high-value prefixes in cache |
| `--enable-hierarchical-cache` | Extends KV capacity from GPU to host memory |
| `--hicache-write-policy write_through` | Host-tier KV always current |
| `--enable-metrics` | Prometheus `/metrics` endpoint |

Tune via `.env` or ConfigMap: `SGLANG_RADIX_EVICTION_POLICY`, `SGLANG_HICACHE_WRITE_POLICY`.

## Troubleshooting

**GPU not detected:** verify `nvidia-smi` works on host; run
`docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi`.

**OOM:** reduce `SGLANG_MEM_FRACTION` (e.g. 0.80) or use a smaller model.

**Health check failing:** model loading takes 2-10 min. Check logs:
`docker compose logs -f sglang-worker` or `kubectl -n codex-inference logs -f sts/sglang-worker`.

**NGC pull fails:** run `docker login nvcr.io` with your NGC API key.
SGLang-only mode (`docker-compose.sglang-only.yml`) does not require NGC.

## File Structure

```
infra/
  README.md
  docker-compose/
    .env.example                         # Environment variables
    docker-compose.sglang-only.yml       # SGLang standalone (simplest)
    docker-compose.yml                   # Full Dynamo + SGLang stack
    docker-compose.disagg.yml            # Prefill/decode disaggregation override
  k8s/
    namespace.yaml
    configmap.yaml
    etcd/                                # Service discovery
      statefulset.yaml, service.yaml
    nats/                                # Event plane (JetStream)
      statefulset.yaml, service.yaml
    sglang/                              # GPU inference workers
      statefulset.yaml, service.yaml
    dynamo/                              # Frontend + router
      deployment.yaml, service.yaml
  codex-config/
    config.toml.example                  # Codex CLI provider config
    codex-env.sh                         # Shell env helper
```
