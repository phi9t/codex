# Codex Architecture Explorer Design

## Summary

Build a repo-root `explorer/` app for Codex that mirrors the style and maintenance model of `~/CodeBase/vllm/explorer`. The explorer is a static React/Vite documentation companion backed by generated JSON manifests. Its primary path explains one Codex turn end to end, while secondary views catalog subsystems, sub-agent collaboration, and runnable probe scripts.

The source of truth is a new `CODEX_HACKERS_GUIDE.md`, paired with a `hacks/` directory. Generator scripts parse the guide, resolve source references against the current checkout, attach probes to guide sections and graph nodes, and emit static data consumed by the browser.

## Goals

- Explain the Codex turn lifecycle from user input to final response.
- Provide a serious sub-agents deep dive covering spawn, messaging, wait/resume, close, roles, registry state, and persistence.
- Keep guide prose, source references, probes, and explorer diagrams aligned through generated manifests.
- Support many probes from the start by using three-digit IDs and numbered bands.
- Keep the browser safe and static: it displays commands and expected output summaries, but does not execute local code.

## Non-Goals

- Do not build a live debugging dashboard in the first version.
- Do not execute `hacks/` from the browser.
- Do not require auth, network, model calls, or app-server startup for ordinary smoke tests.
- Do not attempt to document every crate in depth in v1; prefer a navigable map with clear expansion points.

## Product Shape

The explorer lives at repo root as `explorer/`, following the vLLM Observatory style:

- Dark glass shell and family switcher.
- Static manifests in `explorer/public/data/`.
- SVG architecture graphs with selectable nodes.
- Sticky detail drawers with source refs, guide sections, related hacks, and command hints.
- Typechecked and built with Vite/React.

The main families are:

1. **Turn Lifecycle**: the primary graph and reader path.
2. **Sub-Agents**: a dedicated collaboration deep dive.
3. **Subsystem Map**: major Rust crates and runtime areas.
4. **Hacks**: a browsable probe catalog grouped by guide section and probe band.

## Turn Lifecycle View

The first view follows one Codex turn:

```text
User surface
  -> app-server/core session boundary
  -> turn context/config
  -> model request/stream
  -> tool call dispatch
  -> approval/sandbox decision
  -> shell/apply_patch/MCP/collab execution
  -> transcript/thread persistence
  -> final response
```

Representative source areas include `codex-rs/tui`, `codex-rs/exec`, `codex-rs/app-server`, `codex-rs/app-server-protocol`, `codex-rs/core`, `codex-rs/protocol`, `codex-rs/codex-mcp`, sandboxing crates, rollout/thread-store code, and execution/apply-patch helpers.

## Sub-Agents Deep Dive

Sub-agents get their own guide chapter and explorer family because the behavior spans several layers:

- `AgentControl` is the shared control plane for one root session tree.
- `AgentRegistry` tracks spawn slots, nicknames, paths, thread IDs, last task messages, and total thread limits.
- `SessionSource::SubAgent(SubAgentSource::ThreadSpawn { parent_thread_id, depth, agent_path, agent_nickname, agent_role })` carries parent and identity metadata.
- `agent_max_depth` and `agent_max_threads` limit recursive and total spawned work.
- `agent/role.rs` applies named role config layers at spawn time.
- `Mailbox` and `InterAgentCommunication` deliver inter-agent messages.
- Collab-agent tools cover spawn, send input, wait, resume, and close.
- Core collab events map to app-server `ThreadItem::CollabAgentToolCall` notifications.
- Spawn edges persist so descendant trees can be resumed or closed coherently.
- MultiAgentV2 usage hints differ for root and sub-agent sessions.

The sub-agent graph should show the root thread, shared `AgentControl`, registry reservation, child thread spawn, prompt delivery, mailbox interaction, status updates, persisted spawn edge, and close/resume paths.

## Guide Contract

Add `CODEX_HACKERS_GUIDE.md` at repo root with this structure:

1. How to read this guide
2. 30-second architecture
3. Turn lifecycle overview
4. User surfaces: TUI, `codex exec`, app-server/MCP clients
5. Session and turn context
6. Model request and response stream
7. Tool call dispatch
8. Approvals and sandbox policy
9. Shell execution and PTY handling
10. Patch application
11. MCP tools and connected apps
12. Thread store, rollout, resume, rollback
13. Config, auth, model providers
14. Sub-agents and collaboration
15. Plugins, skills, hooks, multi-agent-adjacent paths
16. App-server protocol as the external API
17. Observability and debugging
18. Hands-on hacks
19. Contributing/updating the guide

Guide conventions:

- Section headers use `## N. Title`.
- Source refs use backticked `path/to/file.rs:123` plus nearby backticked symbols such as `struct Foo`, `enum Bar`, `fn baz`, or `impl Type`.
- Probe refs use `hacks/001_name.py`.
- The 30-second architecture table provides the first lifecycle graph.
- A dedicated sub-agents table provides the sub-agent graph.
- Sections end with `Try it` links where appropriate.
- Generators resolve current line numbers by searching symbols and fall back to the guide hint if unresolved.

## Hacks Design

Create `hacks/` at repo root with three-digit probe IDs. The ID bands reserve room for hundreds of probes:

- `001-099`: core turn lifecycle.
- `100-149`: sub-agents and collaboration.
- `150-199`: app-server and external API.
- `200-249`: MCP, plugins, skills, hooks.
- `250-299`: persistence, rollout, resume, rollback.
- `900-999`: gated/live probes.

Initial core lifecycle probes:

- `001_protocol_lifecycle.py`: inspect `Op`, `EventMsg`, `AgentStatus`, and print the turn state map.
- `002_response_stream_fixture.py`: parse a fixture model stream into Codex events.
- `003_turn_context_config.py`: show how config, cwd, permissions, model, and developer instructions shape a turn.
- `004_tool_dispatch_matrix.py`: summarize shell, apply-patch, MCP, dynamic tools, and collab-agent tool paths.
- `005_approval_sandbox_decision.py`: exercise synthetic approval/sandbox policy cases.
- `006_shell_exec_safe_command.py`: run a harmless command through the closest safe helper path.
- `007_apply_patch_fixture.py`: apply or inspect a small patch fixture in temp space.
- `008_thread_rollout_fixture.py`: read a fixture rollout/thread history and summarize items.
- `009_app_server_event_projection.py`: map core events into app-server item notifications.
- `010_capstone_stub_turn.py`: simulate one full turn with stub model output and stub tool execution.

Initial sub-agent probes:

- `100_agent_registry_limits.py`: explain slot reservation/release and depth calculations from Rust fixtures or source-derived examples.
- `101_subagent_source_shape.py`: print serialized `SessionSource` / `SubAgentSource` examples.
- `102_agent_role_resolution.py`: inspect built-in/user role config shapes without spawning an agent.
- `103_mailbox_delivery.py`: simulate ordered inter-agent messages and trigger-turn behavior.
- `104_collab_event_mapping.py`: feed fixture `CollabAgent*` core events through expected app-server item shapes.
- `105_spawn_edge_history.py`: inspect fixture spawn-edge metadata and open/closed child relationships.
- `106_subagent_resume_tree.py`: simulate breadth-first descendant resume from fixture data.
- `107_capstone_stub_subagents.py`: root spawns worker, sends task, waits, receives completed status, closes worker.
- `140_live_subagent_spawn_gated.py`: gated real spawn path if local auth/config and env opt-in are present.

Each probe should be deterministic unless explicitly gated. Gated probes skip unless their env var is set.

## Explorer Architecture

Mirror the vLLM explorer architecture:

- `explorer/src/App.tsx`: Observatory shell and family switcher.
- `explorer/src/lifecycle/TurnLifecycleExplorer.tsx`: primary graph view.
- `explorer/src/subagents/SubagentsExplorer.tsx`: sub-agent deep dive.
- `explorer/src/subsystems/SubsystemExplorer.tsx`: crate/subsystem catalog.
- `explorer/src/hacks/HacksExplorer.tsx`: probe list, statuses, guide links.
- `explorer/src/explorer-kit/*`: shared async boundary, subject switcher, drawers, graph primitives.
- `explorer/public/data/*.json`: generated manifests only.

Generation scripts:

- `explorer/scripts/build_component_manifest.py`: parses `CODEX_HACKERS_GUIDE.md`, resolves source refs, extracts guide sections, lifecycle nodes, subsystem nodes, and hack references.
- `explorer/scripts/build_subagent_manifest.py`: extracts or validates sub-agent-focused nodes and relationships from the guide/source refs.
- `explorer/scripts/workflow.sh`: rebuilds manifests, runs app typecheck/build, and runs hack smoke tests.

The app must remain static. It shows commands and expected output summaries; execution stays in terminal tests and scripts.

## Data Model

Generated manifests should expose stable, typed sections:

- `generated_at`
- `guide`
- `families`
- `nodes`: `id`, `label`, `group`, `file`, `line`, `symbol`, `section`, `summary`
- `edges`: `from`, `to`, `label`, `kind`
- `sections`: `section`, `title`, first source ref, symbol, related nodes, related hacks
- `hacks`: `id`, `script`, `title`, `section`, `band`, `kind`, `gated`, `command`, `desc`, `expected_shape`
- `source_refs`
- `warnings`

Generator warnings are visible in the explorer as maintenance signals. Unresolved refs should not block early iteration, but a stricter check can fail on warnings once the guide stabilizes.

## Testing

Guide and hacks:

- Non-gated probes run under a smoke test with a timeout.
- Gated probes skip unless their explicit env var is present.
- Probe output asserts exit code and a few stable labels.
- `hacks/README.md` and `CODEX_HACKERS_GUIDE.md` stay aligned with probe IDs.

Manifest generation:

- Generator scripts run without network.
- JSON output is deterministic aside from `generated_at`; if this causes churn, omit or normalize it.
- Unresolved source refs emit warnings in the first pass.

Explorer:

- `npm run typecheck` and `npm run build` pass.
- Lifecycle, sub-agents, subsystem, and hacks views render from static manifests.
- Node labels fit inside graph boxes using vLLM's measured-width rule.
- Detail drawers show source refs, guide section, related hacks, and command hints.
- No browser feature executes local code.

## Acceptance Criteria

- A reader can understand one Codex turn from user input to final response.
- A reader can understand how sub-agents spawn, communicate, wait/resume, and close.
- At least the first 10 lifecycle probes and first 8 sub-agent probes exist or are explicitly stubbed with deterministic output.
- The explorer builds and displays all generated data.
- Probe IDs and manifest schema leave room for hundreds of future exercises.

