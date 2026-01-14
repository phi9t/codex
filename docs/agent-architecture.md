# Codex Agent Architecture

**Engineering Design Document**

## 1. Overview

Codex is a local coding agent that runs in the terminal, providing AI-assisted software development with sandboxed command execution. This document describes the agentic architecture that powers Codex, focusing on the Rust implementation (`codex-rs/`).

### 1.1 Design Goals

- **Async-first**: Non-blocking agent execution with streaming responses
- **Isolation**: Clear separation between client interface and agent runtime
- **Extensibility**: Pluggable task system for different agent workflows
- **Safety**: Sandboxed execution with approval gates
- **Multi-agent**: Support for nested agent spawning and coordination

### 1.2 Non-Goals

- Distributed agent execution across machines
- Persistent agent state across process restarts (beyond conversation history)

---

## 2. System Architecture

### 2.1 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   TUI (tui2) │  │  Exec (exec) │  │  TypeScript SDK        │ │
│  │   Ratatui    │  │  Headless    │  │  (subprocess spawn)    │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Thread Management Layer                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    ThreadManager                          │   │
│  │  • Registry: HashMap<ThreadId, CodexThread>               │   │
│  │  • Shared: ModelsManager, SkillsManager, AuthManager      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     CodexThread                           │   │
│  │  • submit(Op) → sends to Submission Queue                 │   │
│  │  • next_event() → receives from Event Queue               │   │
│  │  • agent_status() → watches status changes                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Runtime Layer                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                        Codex                              │   │
│  │  • tx_sub: Sender<Submission> (Submission Queue)          │   │
│  │  • rx_event: Receiver<Event> (Event Queue)                │   │
│  │  • agent_status: watch::Receiver<AgentStatus>             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                       Session                             │   │
│  │  (Tokio task running submission_loop)                     │   │
│  │  ┌────────────────┐ ┌────────────────┐ ┌───────────────┐ │   │
│  │  │ SessionState   │ │  ActiveTurn    │ │SessionServices│ │   │
│  │  │ • Config       │ │ • RunningTasks │ │ • MCP Manager │ │   │
│  │  │ • History      │ │ • TurnState    │ │ • Exec Manager│ │   │
│  │  │ • Rate Limits  │ │ • Approvals    │ │ • Auth/Skills │ │   │
│  │  └────────────────┘ └────────────────┘ └───────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Systems                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │   LLM API  │  │MCP Servers │  │ File System│  │   Shell   │  │
│  │  (OpenAI)  │  │  (tools)   │  │ (sandboxed)│  │(sandboxed)│  │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Design Pattern: Submission Queue / Event Queue (SQ/EQ)

The agent uses an async message-passing pattern that decouples clients from the agent runtime:

```
Client                    Agent Runtime
  │                            │
  │──── Op (Submission) ──────▶│  Submission Queue (mpsc channel)
  │                            │
  │◀──── Event ───────────────│  Event Queue (mpsc channel)
  │◀──── Event ───────────────│
  │◀──── Event ───────────────│
  │                            │
  │──── Op (Approval) ────────▶│
  │                            │
  │◀──── Event ───────────────│
```

**Benefits:**
- Clients can submit operations without blocking
- Events stream back asynchronously
- Multiple clients can share a single agent (via cloned receivers)
- Clean cancellation via channel closure

---

## 3. Core Components

### 3.1 ThreadManager

**Location:** `codex-rs/core/src/thread_manager.rs`

The top-level registry that manages all agent threads in a process.

```rust
pub struct ThreadManager {
    state: Arc<ThreadManagerState>,
}

struct ThreadManagerState {
    threads: RwLock<HashMap<ThreadId, CodexThread>>,
    models_manager: Arc<ModelsManager>,
    skills_manager: Arc<SkillsManager>,
    auth_manager: Arc<AuthManager>,
}
```

**Responsibilities:**
- Create new agent threads with unique IDs
- Look up existing threads by ID
- Resume threads from previous sessions
- Share common managers across all threads

### 3.2 CodexThread

**Location:** `codex-rs/core/src/codex_thread.rs`

Lightweight wrapper providing the public API for interacting with an agent.

```rust
pub struct CodexThread {
    inner: Codex,
    id: ThreadId,
}

impl CodexThread {
    pub async fn submit(&self, op: Op) -> Result<String>
    pub async fn next_event(&self) -> Option<Event>
    pub fn agent_status(&self) -> AgentStatus
    pub fn subscribe_status(&self) -> watch::Receiver<AgentStatus>
}
```

### 3.3 Codex (Internal Orchestrator)

**Location:** `codex-rs/core/src/codex.rs`

The internal coordinator that owns the communication channels.

```rust
pub(crate) struct Codex {
    next_id: AtomicU64,
    tx_sub: Sender<Submission>,
    rx_event: Receiver<Event>,
    agent_status: watch::Receiver<AgentStatus>,
}
```

### 3.4 Session

**Location:** `codex-rs/core/src/codex.rs` (lines 365-690+)

The stateful agent runtime that processes operations in a dedicated Tokio task.

```rust
struct Session {
    state: SessionState,
    active_turn: ActiveTurn,
    services: Arc<SessionServices>,
    tx_event: Sender<Event>,
    tx_status: watch::Sender<AgentStatus>,
}
```

**The submission loop** (`submission_loop()`) is the heart of the agent:

```rust
async fn submission_loop(mut self, mut rx_sub: Receiver<Submission>) {
    while let Ok(sub) = rx_sub.recv().await {
        match sub.op {
            Op::UserInput { .. } => self.handle_user_input(sub).await,
            Op::UserTurn { .. } => self.handle_user_turn(sub).await,
            Op::Interrupt => self.handle_interrupt().await,
            Op::ExecApproval { .. } => self.handle_exec_approval(sub).await,
            Op::PatchApproval { .. } => self.handle_patch_approval(sub).await,
            Op::Shutdown => break,
            // ... other operations
        }
    }
}
```

---

## 4. State Management

### 4.1 SessionState

Persistent state that survives across turns within a session.

```rust
pub(crate) struct SessionState {
    pub(crate) config: SessionConfiguration,
    pub(crate) context_manager: ContextManager,  // Conversation history
    pub(crate) rate_limit: RateLimitSnapshot,
}
```

### 4.2 SessionConfiguration

Mutable configuration that can be updated during a session.

```rust
pub(crate) struct SessionConfiguration {
    provider: ModelProviderInfo,
    model: String,
    model_reasoning_effort: Option<ReasoningEffortConfig>,
    approval_policy: Constrained<AskForApproval>,
    sandbox_policy: Constrained<SandboxPolicy>,
    cwd: PathBuf,
    developer_instructions: Option<String>,
    user_instructions: Option<String>,
    // ...
}
```

### 4.3 ActiveTurn

State specific to the currently executing turn.

```rust
pub(crate) struct ActiveTurn {
    pub(crate) tasks: IndexMap<String, RunningTask>,
    pub(crate) state: TurnState,
}

pub(crate) struct RunningTask {
    pub(crate) task: Arc<dyn SessionTask>,
    pub(crate) cancellation_token: CancellationToken,
    pub(crate) join_handle: JoinHandle<()>,
}

pub(crate) struct TurnState {
    pub(crate) pending_exec_approval: Option<PendingExecApproval>,
    pub(crate) pending_patch_approval: Option<PendingPatchApproval>,
    pub(crate) awaiting_input: Option<AwaitingInput>,
}
```

### 4.4 Agent Status State Machine

**Location:** `codex-rs/core/src/agent/status.rs`

```
                    ┌─────────────┐
                    │ PendingInit │
                    └──────┬──────┘
                           │ first input
                           ▼
                    ┌─────────────┐
         ┌─────────│   Running   │◀────────┐
         │         └──────┬──────┘         │
         │                │                │
    error│         ┌──────┴──────┐         │new turn
         │         ▼             ▼         │
         │  ┌───────────┐ ┌───────────┐    │
         └─▶│  Errored  │ │ Completed │────┘
            └───────────┘ └─────┬─────┘
                                │
                                ▼
                         ┌───────────┐
                         │  Shutdown │
                         └───────────┘
```

---

## 5. Task System

### 5.1 SessionTask Trait

**Location:** `codex-rs/core/src/tasks/mod.rs`

All agent work is encapsulated as tasks implementing this trait:

```rust
pub(crate) trait SessionTask: Send + Sync + 'static {
    fn kind(&self) -> TaskKind;

    async fn run(
        self: Arc<Self>,
        session: Arc<SessionTaskContext>,
        ctx: Arc<TurnContext>,
        input: Vec<UserInput>,
        cancellation_token: CancellationToken,
    ) -> Option<String>;

    async fn abort(
        &self,
        session: Arc<SessionTaskContext>,
        ctx: Arc<TurnContext>,
    );
}
```

### 5.2 Task Kinds

| Task | Purpose | File |
|------|---------|------|
| `RegularTask` | Standard agent turn (chat + tools) | `tasks/regular.rs` |
| `CompactTask` | Summarize conversation history | `tasks/compact.rs` |
| `ReviewTask` | Code review workflow | `tasks/review.rs` |
| `UndoTask` | Revert previous turn | `tasks/undo.rs` |
| `UserShellCommandTask` | Execute `!` commands | `tasks/user_shell.rs` |
| `GhostSnapshotTask` | Capture workspace state | `tasks/ghost_snapshot.rs` |

### 5.3 Task Lifecycle

```
1. Client submits Op::UserTurn
                │
                ▼
2. Session.spawn_task() creates RunningTask
   • Allocates CancellationToken
   • Spawns Tokio task
   • Registers in ActiveTurn.tasks
                │
                ▼
3. abort_all_tasks() cancels any prior tasks
                │
                ▼
4. Task.run() executes
   • Streams events via tx_event
   • Respects cancellation_token
   • May request approvals (blocking)
                │
                ▼
5. on_task_finished() cleanup
   • Emits TurnCompleteEvent
   • Closes exec processes
   • Updates agent status
```

### 5.4 One-Turn-At-A-Time Guarantee

Sessions enforce that at most one turn executes at a time:

```rust
async fn spawn_task(&mut self, task: Arc<dyn SessionTask>, ...) {
    // Cancel all existing tasks first
    self.abort_all_tasks().await;

    // Then spawn the new task
    let running = RunningTask::new(task, cancellation_token);
    self.active_turn.tasks.insert(task_id, running);
}
```

---

## 6. Operations (Protocol)

**Location:** `codex-rs/protocol/src/protocol.rs`

### 6.1 Op Enum (Client → Agent)

| Operation | Description |
|-----------|-------------|
| `UserInput { items, schema }` | Simple text/image input |
| `UserTurn { items, cwd, ... }` | Full turn with context overrides |
| `Interrupt` | Cancel current task |
| `OverrideTurnContext { ... }` | Update session configuration |
| `ExecApproval { id, decision }` | Approve/deny command execution |
| `PatchApproval { id, decision }` | Approve/deny file patch |
| `AddToHistory { text }` | Log message to history |
| `ListMcpTools` | Enumerate available MCP tools |
| `RefreshMcpServers { config }` | Reinitialize MCP connections |
| `ListCustomPrompts` | Get custom prompts |
| `ListSkills { cwds }` | Get available skills |
| `Compact` | Trigger history summarization |
| `Undo` | Revert last turn |
| `ThreadRollback { n }` | Drop last N turns |
| `Review { request }` | Start review workflow |
| `RunUserShellCommand { cmd }` | Execute `!` command |
| `ResolveElicitation { ... }` | Respond to MCP elicitation |
| `Shutdown` | Terminate agent |

### 6.2 Event Enum (Agent → Client)

| Event | Description |
|-------|-------------|
| `SessionConfigured` | Session ready with initial config |
| `TurnStarted` | Turn began processing |
| `TurnComplete` | Turn finished |
| `TurnAborted` | Turn was cancelled |
| `ItemStarted` / `ItemCompleted` | Tool/message lifecycle |
| `ExecApprovalRequest` | Request command approval |
| `PatchApprovalRequest` | Request patch approval |
| `AgentThinking` | Model is reasoning |
| `TaskStarted` / `TaskComplete` | Background task lifecycle |
| `McpListToolsResponse` | MCP tools enumeration |
| `Error` | Error occurred |
| `RateLimitWarning` | Approaching rate limits |
| `ShutdownComplete` | Agent terminated |

---

## 7. SessionServices

**Location:** `codex-rs/core/src/state/service.rs`

Aggregated services available to all tasks within a session:

```rust
pub(crate) struct SessionServices {
    // MCP (Model Context Protocol)
    pub(crate) mcp_connection_manager: Arc<RwLock<McpConnectionManager>>,
    pub(crate) mcp_startup_cancellation_token: Mutex<CancellationToken>,

    // Execution
    pub(crate) unified_exec_manager: UnifiedExecProcessManager,
    pub(crate) user_shell: Arc<Shell>,
    pub(crate) exec_policy: ExecPolicyManager,

    // Auth & Models
    pub(crate) auth_manager: Arc<AuthManager>,
    pub(crate) models_manager: Arc<ModelsManager>,

    // Skills & Prompts
    pub(crate) skills_manager: Arc<SkillsManager>,

    // Multi-Agent
    pub(crate) agent_control: AgentControl,

    // Observability
    pub(crate) notifier: UserNotifier,
    pub(crate) rollout: Mutex<Option<RolloutRecorder>>,
    pub(crate) otel_manager: OtelManager,

    // Approvals
    pub(crate) tool_approvals: Mutex<ApprovalStore>,
}
```

---

## 8. Multi-Agent Support

**Location:** `codex-rs/core/src/agent/control.rs`

### 8.1 AgentControl

Enables agents to spawn and manage other agents:

```rust
pub(crate) struct AgentControl {
    manager: Weak<ThreadManagerState>,
}

impl AgentControl {
    pub(crate) async fn spawn_agent(
        &self,
        config: Config,
        prompt: String,
        headless: bool,
    ) -> CodexResult<ThreadId>

    pub(crate) async fn send_prompt(
        &self,
        agent_id: ThreadId,
        prompt: String,
    ) -> CodexResult<String>

    pub(crate) async fn shutdown_agent(
        &self,
        agent_id: ThreadId,
    ) -> CodexResult<String>

    pub(crate) async fn subscribe_status(
        &self,
        agent_id: ThreadId,
    ) -> CodexResult<watch::Receiver<AgentStatus>>
}
```

### 8.2 Reference Cycle Prevention

`AgentControl` uses `Weak<ThreadManagerState>` to prevent reference cycles:

```
ThreadManager (Arc)
      │
      ▼
ThreadManagerState (Arc)
      │
      ├──▶ CodexThread
      │         │
      │         ▼
      │    Session
      │         │
      │         ▼
      │    SessionServices
      │         │
      │         ▼
      └───◀ AgentControl (Weak)  ←── breaks the cycle
```

### 8.3 Headless Drain Pattern

When agents are spawned headless (no UI), a drain task consumes events:

```rust
if headless {
    tokio::spawn(async move {
        while let Some(_event) = thread.next_event().await {
            // Discard events to prevent unbounded memory growth
        }
    });
}
```

---

## 9. Tool Execution Flow

### 9.1 Tool Orchestration

```
Model Response
      │
      ▼
┌─────────────────┐
│ ToolOrchestrator│
└────────┬────────┘
         │
         ├─────────────────┬─────────────────┬─────────────────┐
         ▼                 ▼                 ▼                 ▼
   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
   │   Shell   │    │   Patch   │    │ MCP Tools │    │  Built-in │
   │  Command  │    │   Apply   │    │           │    │   Tools   │
   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
         │                │                │                │
         ▼                ▼                ▼                ▼
   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
   │ Approval  │    │ Approval  │    │  Direct   │    │  Direct   │
   │   Gate    │    │   Gate    │    │ Execution │    │ Execution │
   └─────┬─────┘    └─────┬─────┘    └───────────┘    └───────────┘
         │                │
         ▼                ▼
   ┌───────────┐    ┌───────────┐
   │ Sandboxed │    │   File    │
   │   Exec    │    │   Write   │
   └───────────┘    └───────────┘
```

### 9.2 Approval Flow

```
1. Tool call received from model
              │
              ▼
2. Check approval policy
   • "never" → auto-deny
   • "on-failure" → auto-approve unless failed before
   • "on-request" → require approval
   • "untrusted" → always require approval
              │
              ▼
3. If approval needed:
   • Emit ExecApprovalRequest event
   • Set pending_exec_approval in TurnState
   • Wait for Op::ExecApproval
              │
              ▼
4. Execute with sandbox policy
   • "read-only" → no writes, no network
   • "workspace-write" → writes to cwd only, no network
   • "danger-full-access" → unrestricted
```

---

## 10. TypeScript SDK Integration

**Location:** `sdk/typescript/`

### 10.1 Thread Class

```typescript
export class Thread {
    private _exec: CodexExec;

    async runStreamed(input: Input, options?: TurnOptions): Promise<StreamedTurn>
    async run(input: Input, options?: TurnOptions): Promise<Turn>
}
```

### 10.2 Integration Architecture

```
TypeScript Application
         │
         ▼
┌─────────────────┐
│   Thread Class  │
│  (SDK wrapper)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   CodexExec     │
│ (process spawn) │
└────────┬────────┘
         │ subprocess
         ▼
┌─────────────────┐
│   Rust CLI      │
│ (codex exec)    │
└────────┬────────┘
         │ JSON events via stdout
         ▼
┌─────────────────┐
│  Event Parser   │
│  (SDK side)     │
└─────────────────┘
```

---

## 11. Key Invariants

1. **One turn at a time**: New turns abort all previous tasks before starting
2. **Status consistency**: Status transitions only occur via defined events
3. **Approval blocking**: Approval requests block task execution until resolved
4. **Weak references**: AgentControl uses Weak refs to prevent cycles
5. **Channel closure**: Shutdown is signaled via channel closure, not explicit messages
6. **Sandbox enforcement**: All tool execution respects the configured sandbox policy

---

## 12. Extension Points

| Extension Point | Mechanism |
|----------------|-----------|
| New task types | Implement `SessionTask` trait |
| Custom tools | Register via MCP servers |
| Approval policies | Configure via `AskForApproval` enum |
| Sandbox policies | Configure via `SandboxPolicy` enum |
| Model providers | Add to `ModelProviderInfo` |
| Skills | Add `.md` files to skills directories |

---

## 13. File Reference

### Core Agent
| File | Description |
|------|-------------|
| `core/src/thread_manager.rs` | Thread registry |
| `core/src/codex_thread.rs` | Public thread API |
| `core/src/codex.rs` | Orchestrator + Session |
| `core/src/agent/control.rs` | Multi-agent control |
| `core/src/agent/status.rs` | Status state machine |

### State Management
| File | Description |
|------|-------------|
| `core/src/state/session.rs` | SessionState |
| `core/src/state/turn.rs` | ActiveTurn, RunningTask |
| `core/src/state/service.rs` | SessionServices |

### Tasks
| File | Description |
|------|-------------|
| `core/src/tasks/mod.rs` | SessionTask trait |
| `core/src/tasks/regular.rs` | Standard turn |
| `core/src/tasks/compact.rs` | History summarization |
| `core/src/tasks/review.rs` | Code review |

### Protocol
| File | Description |
|------|-------------|
| `protocol/src/protocol.rs` | Op and Event enums |

### TypeScript SDK
| File | Description |
|------|-------------|
| `sdk/typescript/src/thread.ts` | Thread class |
| `sdk/typescript/src/codexExec.ts` | Process spawning |
