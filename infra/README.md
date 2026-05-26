# Self-Hosted Inference for Codex and Claude Code (Dynamo + SGLang)

Containerized infrastructure for serving open-source models to **Codex CLI** and
**Claude Code CLI** using NVIDIA Dynamo (cluster orchestration) and SGLang
(inference runtime).

## Architecture

```text
Codex CLI ────────┐
                  ├── Edge / auth / per-tenant policy
Claude Code CLI ──┘
                        ├── Codex adapter:  /v1/responses or /v1/chat/completions
                        └── Claude adapter: /v1/messages (requires translation layer)
                        │
                    Dynamo Frontend (protocol normalization, request queueing)
                        │
                    Dynamo Router (KV-aware routing, priority scheduling)
                        │
                ┌───────┼───────┐
                │       │       │
           SGLang    SGLang   SGLang
           Worker    Worker   Worker
            (GPU)    (GPU)    (GPU)
                │       │       │
           RadixAttention / HiCache / Priority Scheduling
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

# Apply security hardening (NetworkPolicy, ResourceQuota, ServiceAccounts)
kubectl apply -f infra/k8s/network-policy.yaml
kubectl apply -f infra/k8s/resource-quota.yaml
kubectl apply -f infra/k8s/serviceaccounts.yaml

# Optional: create HuggingFace token secret (required for gated models)
# Use the provided template — do NOT commit the filled-in file to git
cp infra/k8s/hf-secret.yaml.example infra/k8s/hf-secret.yaml
# Edit hf-secret.yaml and set your token, then:
kubectl apply -f infra/k8s/hf-secret.yaml

# Deploy infrastructure: etcd, NATS, SGLang workers, Dynamo frontend
kubectl apply -f infra/k8s/etcd/
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

### Kubernetes: Autoscaling and Availability

The Dynamo frontend Deployment ships with a **HorizontalPodAutoscaler** (min 2 / max 8
replicas, CPU target 70%) and a **PodDisruptionBudget** (`minAvailable: 1`) to ensure
at least one frontend pod remains up during node drains and rolling updates.

```bash
# HPA and PDB are applied as part of infra/k8s/dynamo/
kubectl -n codex-inference get hpa,pdb
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

## Claude Code Integration

SGLang serves an OpenAI-compatible API (`/v1/chat/completions`). Claude Code
requires Anthropic Messages API semantics (`/v1/messages`, `/v1/messages/count_tokens`)
with preserved headers like `anthropic-beta` and `anthropic-version`.

A **translation layer** is needed between Claude Code and the SGLang/Dynamo backend.
The simplest option is [litellm](https://docs.litellm.ai/):

```bash
# Run litellm as a proxy (translates Anthropic Messages -> OpenAI Chat)
pip install litellm
litellm --model openai/Qwen/Qwen2.5-Coder-7B-Instruct \
        --api_base http://localhost:30000 \
        --port 4000

# Then point Claude Code at the litellm proxy:
export ANTHROPIC_BASE_URL=http://localhost:4000
```

For production, run litellm as a Docker container or deploy a purpose-built
translation service. The adapter should:

1. Accept `/v1/messages` and `/v1/messages/count_tokens`
2. Translate to `/v1/chat/completions` (or `/v1/responses`)
3. Preserve `anthropic-beta`, `anthropic-version`, and session headers
4. Stream SSE responses back in Anthropic Messages format

The adapter must be stateless and translation-only. Routing stays in Dynamo.

## Agentic Workload Optimization

All SGLang workers are launched with flags optimized for coding-agent workloads:

- **`--enable-priority-scheduling`** — allows P0 interactive requests to preempt
  P2 background jobs in the scheduler queue
- **`--radix-eviction-policy priority`** — preserves high-value session prefixes
  (system prompt, tool schemas, conversation stem) in the radix cache longer
- **`--enable-hierarchical-cache`** — enables HiCache, extending KV capacity from
  GPU VRAM to host memory for warm-tier storage
- **`--hicache-write-policy write_through`** — ensures host-tier KV is always
  current, preventing loss of valuable prefixes on GPU eviction

These matter because coding-agent sessions are **write-once-read-many KV workloads**:
after the first turn, 85-97% of tokens are cached prefix. Priority scheduling
ensures interactive turns stay fast even when background analysis jobs are queued.

Additional reliability and tool-use flags (enabled in all configurations):

- **`--tool-call-parser qwen25`** — enables structured parsing of tool/function call
  output from the model. Required for agentic tool use (file edits, shell execution,
  web search). The parser must match the model family: `qwen25` for Qwen2.5-Coder,
  `llama3` for Llama-3.x, `mistral` for Mistral series.
- **`--watchdog-timeout 300`** — kills and restarts the worker process if inference
  stalls for more than 300 seconds (catches GPU deadlocks and NCCL hangs silently).

Tune via `.env` (Docker Compose) or the ConfigMap (Kubernetes):

```bash
SGLANG_RADIX_EVICTION_POLICY=priority    # or "lru" for simpler behavior
SGLANG_HICACHE_WRITE_POLICY=write_through # or "write_back" for lower host I/O
SGLANG_TOOL_CALL_PARSER=qwen25           # match to your model family
SGLANG_WATCHDOG_TIMEOUT=300             # seconds before stalled worker is restarted
```

## Security Hardening

### Kubernetes

The Kubernetes manifests implement defense-in-depth at the namespace level:

**NetworkPolicy** (`infra/k8s/network-policy.yaml`)

Default-deny-ingress for the entire namespace, then explicit allow rules for
each required traffic path. Only these paths are open:

| Source | Destination | Port | Purpose |
|--------|-------------|------|---------|
| dynamo-frontend | sglang-worker | 30000 | Inference requests |
| dynamo-frontend | nats | 4222 | KV events / load metrics |
| dynamo-frontend | etcd | 2379 | Service discovery |
| sglang-worker | nats | 4222 | KV events / load metrics |
| sglang-worker | etcd | 2379 | Service registration |
| sglang-worker | 0.0.0.0 | 443 | HuggingFace model download |
| prometheus | sglang-worker | 30000 | Metrics scrape |
| prometheus | dynamo-frontend | 8000 | Metrics scrape |
| prometheus | nats | 8222 | Monitor scrape |
| prometheus | K8s API | 443/6443 | Service discovery |
| external | dynamo-frontend | 8000 | Inference API |
| external | prometheus | 9090 | Port-forward access |

Once models are cached in the PVC, remove the `allow-sglang-egress` policy's
`port: 443` rule to eliminate internet egress from SGLang pods entirely.

**SecurityContext**

All pods run with the minimum privileges their workload requires:

| Component | runAsNonRoot | User | Drop ALL caps | allowPrivEscalation |
|-----------|-------------|------|--------------|---------------------|
| etcd | yes | 1001 | yes | false |
| nats | yes | 1000 | yes | false |
| dynamo-frontend | — | — | yes | false |
| sglang-worker | — | — | — | false |
| prometheus | yes | 65534 | yes | false |

SGLang is conservative: CUDA/GPU drivers can require root and broad syscall
access. `allowPrivilegeEscalation: false` is applied; full capability drops are
not, as they can break GPU context creation on some driver versions.

**ServiceAccounts** (`infra/k8s/serviceaccounts.yaml`)

Each workload has a dedicated ServiceAccount with `automountServiceAccountToken:
false`. None of these services need Kubernetes API access; isolating them
prevents a compromised pod from using a mounted token to enumerate or modify
cluster state.

**ResourceQuota** (`infra/k8s/resource-quota.yaml`)

Namespace-level quota caps CPU, memory, GPU, PVC count, and pod count. Adjust
`requests.nvidia.com/gpu` and `limits.nvidia.com/gpu` to match your node pool.

### Docker Compose

For local development, non-GPU services (etcd, NATS, dynamo-frontend,
Prometheus) run with:

- `security_opt: [no-new-privileges:true]` — prevents setuid/setgid escalation
- `deploy.resources.limits` — memory and CPU caps to prevent runaway containers
- NATS monitor port 8222 is not exposed on the host (Prometheus scrapes it
  internally via the Docker network)

The Kubernetes manifests pin non-root UIDs via `securityContext` + `fsGroup`,
which fixes volume ownership automatically. Plain Docker Compose has no `fsGroup`
equivalent, so containers use each image's built-in default user rather than a
forced `user:` override (a forced non-root UID can't write a freshly created,
root-owned named volume on first boot). In practice `bitnami/etcd` (uid 1001)
and `prom/prometheus` (nobody) already default to non-root; `nats:2.10` defaults
to root, so for stricter setups run it under an orchestrator that provides
`fsGroup` (e.g. the Kubernetes manifests here, where NATS is fully hardened).

## Observability

SGLang workers expose a Prometheus-compatible `/metrics` endpoint when launched
with `--enable-metrics` (enabled by default in all configurations here).

Key metrics to monitor:

| Metric | What it tells you |
|--------|-------------------|
| TTFT (time to first token) | Interactive responsiveness |
| ITL (inter-token latency) | Streaming smoothness |
| Cache hit rate / overlap score | KV reuse effectiveness |
| Queue depth | Backpressure / capacity headroom |
| GPU memory utilization | OOM risk |
| Inflight requests | Concurrency load |

### Docker Compose: Prometheus + Grafana

Add the monitoring overlay to any Compose stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3000  (anonymous read-only)
```

The overlay ships with `prometheus.yml` (scrapes SGLang and Dynamo metrics) and
`grafana-datasources.yml` (auto-provisions Prometheus as default data source).

### Kubernetes: Prometheus + Alerting

`infra/k8s/monitoring/` deploys a self-contained Prometheus instance using only
native Kubernetes objects (Deployment, ConfigMap, PVC, ServiceAccount, Role,
RoleBinding, Service — no CRDs or operators required).

```bash
kubectl apply -f infra/k8s/monitoring/
# Access via port-forward:
kubectl port-forward -n codex-inference svc/prometheus 9090:9090
# Verify alerting rules loaded:
# browse http://localhost:9090/rules → should show the codex-inference group
```

Prometheus discovers targets using `kubernetes_sd_configs` (service role) scoped
to the `codex-inference` namespace. Any Service with the annotation
`prometheus.io/scrape: "true"` is automatically scraped. Both `sglang-worker` and
`dynamo-frontend` services carry this annotation.

Dynamo frontend also exposes metrics (`dynamo_frontend_inflight_requests`,
`dynamo_frontend_queued_requests`) on its metrics port.

**Alerting rules** (`infra/k8s/monitoring/prometheus-alerts.yaml`) define five alerts:

| Alert | Condition | Severity |
|-------|-----------|---------|
| `SGLangWorkerDown` | No healthy worker for 2 min | critical |
| `DynamoFrontendDown` | No healthy frontend for 1 min | critical |
| `HighQueueDepth` | Queued requests > 100 for 5 min | warning |
| `HighInflightRequests` | Inflight requests > 200 for 10 min | warning |
| `SGLangWorkerRestarting` | Container restart detected | warning |

`SGLangWorkerRestarting` uses `kube_pod_container_status_restarts_total` from
kube-state-metrics. If your cluster doesn't have it, use the fallback expr
documented in `prometheus-alerts.yaml`: `changes(up{service="sglang-worker"}[10m]) > 1`.

To connect an Alertmanager, add `alerting:` and `alertmanagers:` sections to the
`prometheus-config` ConfigMap and `kubectl rollout restart deployment/prometheus`.

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
    docker-compose.monitoring.yml        # Prometheus + Grafana overlay
    prometheus.yml                       # Prometheus scrape config
    grafana-datasources.yml              # Grafana datasource provisioning
  k8s/
    namespace.yaml                       # codex-inference namespace
    configmap.yaml                       # Shared configuration
    hf-secret.yaml.example              # HuggingFace token secret template
    network-policy.yaml                  # NetworkPolicy: default-deny + allow rules
    resource-quota.yaml                  # ResourceQuota: CPU, memory, GPU, pod caps
    serviceaccounts.yaml                 # Dedicated ServiceAccounts (no token automount)
    etcd/
      statefulset.yaml                   # etcd single-node (service discovery)
      service.yaml                       # etcd services (headless + ClusterIP)
    nats/
      statefulset.yaml                   # NATS + JetStream
      service.yaml                       # NATS services
    sglang/
      statefulset.yaml                   # SGLang GPU workers
      service.yaml                       # SGLang services
    dynamo/
      deployment.yaml                    # Dynamo frontend
      service.yaml                       # Dynamo service
      pdb.yaml                           # PodDisruptionBudget (minAvailable: 1)
      hpa.yaml                           # HorizontalPodAutoscaler (CPU 70%)
    monitoring/
      prometheus.yaml                    # Prometheus (Deployment, ConfigMap, RBAC, PVC, Service)
      prometheus-alerts.yaml             # Alerting rules ConfigMap (worker down, queue depth)
  codex-config/
    config.toml.example                  # Codex CLI provider config
    codex-env.sh                         # Shell env helper
```
