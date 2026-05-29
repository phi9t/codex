import { useEffect, useState } from "react";

import { fetchExplorerJson, errorMessage } from "../lib/fetch";
import { AsyncBoundary, type AsyncState } from "../explorer-kit/AsyncBoundary";
import { DetailDrawer } from "../explorer-kit/DetailDrawer";

type SourceRef = {
  file: string;
  line: number;
};

type LifecycleNode = {
  id: string;
  label: string;
  file?: string;
  line?: number;
  symbol?: string;
  summary?: string;
  section?: string;
  source_ref?: SourceRef;
};

type LifecycleEdge = {
  from: string;
  to: string;
  kind: string;
  label: string;
};

type LifecycleManifest = {
  nodes: LifecycleNode[];
  edges: LifecycleEdge[];
  warnings?: string[];
};

type PositionedLifecycleNode = LifecycleNode & {
  width: number;
  height: number;
  x: number;
  y: number;
  depth: number;
  index: number;
  lane: GraphLane;
};

type GraphLane = {
  id: string;
  label: string;
};

const lifecycleLanes: GraphLane[] = [
  { id: "surface", label: "Surface" },
  { id: "core", label: "Core session" },
  { id: "model", label: "Model + tools" },
  { id: "execution", label: "Execution" },
  { id: "history", label: "History + projection" },
];

const lifecycleNodeHeight = 58;
const lifecycleNodeWidth = 196;
const verticalSpacing = 104;
const laneWidth = 236;
const laneHeaderHeight = 46;
const sourceRoot = "https://github.com/phi9t/codex/blob/phi9t-mainline";
const lifecycleGuideHref = `${sourceRoot}/CODEX_HACKERS_GUIDE.md#3-turn-lifecycle-overview`;

const lifecycleDeepDives: Record<string, string> = {
  "user-surface":
    "The interactive surfaces normalize user input into a turn command with cwd, approval policy, model, and permission context before the core session sees it.",
  exec:
    "The non-interactive exec path packages prompt items into app-server turn start parameters so automation follows the same core event stream.",
  "app-server":
    "The app server exposes the external protocol boundary and projects core events into client-facing thread items.",
  "core-session":
    "The core session owns the submission queue, turn state, service handles, and event receiver that every surface observes.",
  "model-stream":
    "Model response items are parsed, persisted, and converted into either user-visible events or queued tool work.",
  "tool-dispatch":
    "The tool router classifies model tool calls and selects the local runtime path for shell, patch, MCP, image, and dynamic tools.",
  "approvals-and-sandbox":
    "Approval and sandbox policy determine whether a requested action can run directly, needs review, or must be constrained by filesystem/network policy.",
  "execution-mcp-patch":
    "Execution adapters run approved work through shell, MCP, patch, or related handlers and return structured outputs to the turn.",
  "thread-history":
    "Rollout items persist the reconstructed session so resume, fork, rollback, and downstream projections can replay the turn state.",
  protocol:
    "Protocol events are the stable internal contract that clients consume to render progress, tool output, errors, and final turn completion.",
  "app-event-mapping":
    "Event mapping translates core protocol events into app-server notifications and thread items for API consumers.",
};

function laneForLifecycleNode(node: LifecycleNode): GraphLane {
  if (node.id.includes("approval") || node.id.includes("execution")) {
    return lifecycleLanes[3];
  }
  if (node.id.includes("user") || node.id.includes("app-server") || node.id === "exec") {
    return lifecycleLanes[0];
  }
  if (node.id.includes("core")) {
    return lifecycleLanes[1];
  }
  if (node.id.includes("model") || node.id.includes("tool")) {
    return lifecycleLanes[2];
  }
  return lifecycleLanes[4];
}

function edgeColor(kind: string): string {
  switch (kind) {
    case "call":
      return "var(--accent)";
    case "state":
      return "var(--execution)";
    case "spawn":
      return "#9dffb3";
    case "message":
      return "#6bc5ff";
    case "event":
      return "#d7a8ff";
    default:
      return "var(--text-muted)";
  }
}

function layoutLifecycleGraph(
  nodes: LifecycleNode[],
  edges: LifecycleEdge[],
): {
  nodes: PositionedLifecycleNode[];
  width: number;
  height: number;
} {
  const byId = new Map<string, LifecycleNode>();
  for (const node of nodes) {
    byId.set(node.id, node);
  }

  const outgoing = new Map<string, LifecycleEdge[]>();
  const indegree = new Map<string, number>();
  for (const node of nodes) {
    indegree.set(node.id, 0);
  }
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) {
      continue;
    }
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, incoming] of indegree) {
    if (incoming === 0) {
      queue.push(id);
    }
  }

  const depthById = new Map<string, number>();
  const depthBumpsById = new Map<string, number>();
  for (const id of queue) {
    depthById.set(id, 0);
  }

  const maxDepth = Math.max(1, nodes.length);
  const pending: string[] = [...queue];

  while (pending.length > 0) {
    const currentId = pending.shift();
    if (currentId === undefined) {
      continue;
    }

    const sourceDepth = depthById.get(currentId) ?? 0;
    const nextEdges = outgoing.get(currentId) ?? [];
    for (const edge of nextEdges) {
      const nextDepth = sourceDepth + 1;
      if (nextDepth > maxDepth) {
        continue;
      }

      const currentDepth = depthById.get(edge.to) ?? 0;
      if (nextDepth > currentDepth) {
        depthById.set(edge.to, nextDepth);
        const updateCount = (depthBumpsById.get(edge.to) ?? 0) + 1;
        depthBumpsById.set(edge.to, updateCount);

        if (updateCount <= maxDepth) {
          pending.push(edge.to);
        }
      }
    }
  }

  const laneRows = new Map<string, string[]>();
  for (const node of nodes) {
    const lane = laneForLifecycleNode(node);
    const row = laneRows.get(lane.id) ?? [];
    row.push(node.id);
    laneRows.set(lane.id, row);
  }

  const positioned: PositionedLifecycleNode[] = [];

  for (const lane of lifecycleLanes) {
    const nodeIds = laneRows.get(lane.id) ?? [];
    nodeIds.sort(
      (left, right) => (depthById.get(left) ?? 0) - (depthById.get(right) ?? 0),
    );
    for (let index = 0; index < nodeIds.length; index += 1) {
      const id = nodeIds[index];
      const node = byId.get(id);
      if (node === undefined) {
        continue;
      }
      const laneIndex = lifecycleLanes.findIndex((candidate) => candidate.id === lane.id);
      const positionedNode: PositionedLifecycleNode = {
        ...node,
        width: lifecycleNodeWidth,
        height: lifecycleNodeHeight,
        x: 24 + laneIndex * laneWidth,
        y: laneHeaderHeight + 22 + index * verticalSpacing,
        depth: depthById.get(node.id) ?? 0,
        index,
        lane,
      };
      positioned.push(positionedNode);
    }
  }

  const maxX = positioned.reduce(
    (max, node) => Math.max(max, node.x + node.width),
    0,
  );
  const maxY = positioned.reduce((max, node) => Math.max(max, node.y + node.height), 0);

  return {
    nodes: positioned,
    width: Math.max(700, maxX + 32),
    height: Math.max(260, maxY + 120),
  };
}

function renderLifecycleEdge(
  from: PositionedLifecycleNode,
  to: PositionedLifecycleNode,
  index: number,
  edge: LifecycleEdge,
) {
  const isBackwardEdge = to.x < from.x;
  const startX = isBackwardEdge ? from.x : from.x + from.width;
  const startY = from.y + from.height / 2;
  const endX = isBackwardEdge ? to.x + to.width : to.x;
  const endY = to.y + to.height / 2;
  const routeY = Math.max(startY, endY) + 42 + (index % 3) * 16;
  const midX = startX + Math.max(28, (endX - startX) / 2);
  const d = isBackwardEdge
    ? `M ${startX} ${startY} L ${startX - 18} ${startY} L ${startX - 18} ${routeY} L ${endX + 18} ${routeY} L ${endX + 18} ${endY} L ${endX} ${endY}`
    : `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
  const labelY = isBackwardEdge ? routeY - 7 : Math.min(startY, endY) - 8 - (index % 2) * 18;
  const labelX = isBackwardEdge ? (startX + endX) / 2 : midX;

  const isQuietLifecycleEdge = edge.label === "lifecycle" || edge.label === edge.kind;

  return (
    <g key={`${from.id}-${to.id}-${index}`}>
      <path d={d} stroke={edgeColor(edge.kind)} fill="none" strokeWidth={1.4} markerEnd="url(#arrow)" />
      {!isQuietLifecycleEdge && renderEdgeLabelBadge(labelX, labelY, edge.label)}
    </g>
  );
}

function renderEdgeLabelBadge(x: number, y: number, label: string): React.ReactElement {
  const width = Math.max(54, label.length * 6.4 + 18);
  return (
    <g className="graph-edge-label" aria-hidden>
      <rect
        className="graph-edge-label__bg"
        x={x - width / 2}
        y={y - 15}
        width={width}
        height={19}
        rx={5}
        ry={5}
      />
      <text x={x} y={y - 2} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function sortLifecycleWarnings(warnings: string[]): string[] {
  return [...warnings].sort((left, right) => left.localeCompare(right));
}

function basename(path: string | undefined): string {
  if (path === undefined) {
    return "source unknown";
  }
  return path.split("/").at(-1) ?? path;
}

function lifecycleNodeMeta(node: LifecycleNode): string {
  const line = node.line ?? node.source_ref?.line;
  return line === undefined ? basename(node.file) : `${basename(node.file)}:${line}`;
}

function sourceHref(node: LifecycleNode): string | undefined {
  const file = node.file ?? node.source_ref?.file;
  const line = node.line ?? node.source_ref?.line;
  if (file === undefined) {
    return undefined;
  }
  return line === undefined ? `${sourceRoot}/${file}` : `${sourceRoot}/${file}#L${line}`;
}

function lifecycleDeepDive(node: LifecycleNode): string {
  return lifecycleDeepDives[node.id] ?? "This node is part of the Codex turn lifecycle map generated from the hacker guide source table.";
}

export function TurnLifecycleExplorer(): React.ReactElement {
  const [manifestState, setManifestState] = useState<AsyncState<LifecycleManifest>>({
    status: "loading",
  });
  const [selectedNode, setSelectedNode] = useState<LifecycleNode | null>(null);

  useEffect(() => {
    let active = true;

    void fetchExplorerJson<LifecycleManifest>("components.json")
      .then((manifest) => {
        if (active) {
          setManifestState({ status: "ready", data: manifest });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setManifestState({ status: "error", error: errorMessage(error) });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="explorer-view" aria-label="Turn lifecycle view">
      <AsyncBoundary state={manifestState}>
        {(manifest) => {
          const graph = layoutLifecycleGraph(manifest.nodes, manifest.edges);
          const indexById = new Map(graph.nodes.map((node) => [node.id, node]));
          const activeNode =
            selectedNode ?? graph.nodes.find((node) => node.id === "core-session") ?? graph.nodes[0] ?? null;
          const activeSourceHref = activeNode === null ? undefined : sourceHref(activeNode);

          return (
            <>
              <div className="graph-wrap">
                <svg
                  className="graph-svg"
                  viewBox={`0 0 ${graph.width} ${graph.height}`}
                  preserveAspectRatio="xMinYMin meet"
                  role="img"
                  aria-label="Lifecycle node graph"
                >
                  <defs>
                    <marker
                      id="arrow"
                      markerWidth="10"
                      markerHeight="10"
                      refX="8"
                      refY="3"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0,0 L0,6 L8,3 z" fill={edgeColor("call")} />
                    </marker>
                  </defs>

                  <g className="graph-swimlanes">
                    {lifecycleLanes.map((lane, index) => (
                      <g key={lane.id} className="graph-lane">
                        <rect
                          x={12 + index * laneWidth}
                          y={10}
                          width={laneWidth - 24}
                          height={graph.height - 24}
                          rx={8}
                          ry={8}
                        />
                        <text x={24 + index * laneWidth} y={34} className="graph-lane__label">
                          {lane.label}
                        </text>
                      </g>
                    ))}
                  </g>
                  <g>
                    {manifest.edges.flatMap((edge, index) => {
                      const source = indexById.get(edge.from);
                      const target = indexById.get(edge.to);
                      if (source === undefined || target === undefined) {
                        return [];
                      }
                      return renderLifecycleEdge(source, target, index, edge);
                    })}
                  </g>
                  {graph.nodes.map((node) => {
                    const selected = selectedNode?.id === node.id;
                    return (
                      <g
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedNode(node);
                          }
                        }}
                        role="button"
                        aria-label={`Open details for ${node.label}`}
                        className={selected ? "graph-node is-selected" : "graph-node"}
                      >
                        <rect
                          x={node.x}
                          y={node.y}
                          width={node.width}
                          height={node.height}
                          rx={6}
                          ry={6}
                          className="graph-node__box"
                        />
                        <text x={node.x + 12} y={node.y + 23} className="graph-node__label">
                          {node.label}
                        </text>
                        <text x={node.x + 12} y={node.y + 42} className="graph-node__meta">
                          {lifecycleNodeMeta(node)}
                        </text>
                        <title>{node.summary ?? node.label}</title>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <ul className="source-list">
                {sortLifecycleWarnings(manifest.warnings ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <section className="deep-dive-panel" aria-label="Lifecycle code deep dive">
                {activeNode === null ? (
                  <p>No lifecycle node available.</p>
                ) : (
                  <>
                    <header>
                      <p className="eyebrow">Code deep dive</p>
                      <h3>{activeNode.label}</h3>
                    </header>
                    <p>{lifecycleDeepDive(activeNode)}</p>
                    <dl className="detail-grid">
                      <div>
                        <dt>Implementation</dt>
                        <dd>
                          {activeSourceHref === undefined ? (
                            "Source location unavailable"
                          ) : (
                            <a href={activeSourceHref} target="_blank" rel="noreferrer">
                              {activeNode.file ?? activeNode.source_ref?.file}:{activeNode.line ?? activeNode.source_ref?.line}
                            </a>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Symbol</dt>
                        <dd>{activeNode.symbol ?? "n/a"}</dd>
                      </div>
                      <div>
                        <dt>Guide</dt>
                        <dd>
                          <a href={lifecycleGuideHref} target="_blank" rel="noreferrer">
                            CODEX_HACKERS_GUIDE.md §3
                          </a>
                        </dd>
                      </div>
                    </dl>
                  </>
                )}
              </section>
              <DetailDrawer
                isOpen={selectedNode !== null}
                title={selectedNode?.label ?? "Lifecycle node"}
                onClose={() => setSelectedNode(null)}
              >
                {selectedNode === null ? (
                  <p>No node selected.</p>
                ) : (
                  <dl className="detail-grid">
                    <div>
                      <dt>Node</dt>
                      <dd>{selectedNode.id}</dd>
                    </div>
                    <div>
                      <dt>Label</dt>
                      <dd>{selectedNode.label}</dd>
                    </div>
                    <div>
                      <dt>Summary</dt>
                      <dd>{selectedNode.summary ?? "Not available"}</dd>
                    </div>
                    <div>
                      <dt>Location</dt>
                      <dd>
                        {selectedNode.file ?? selectedNode.source_ref?.file}
                        :
                        {selectedNode.line ?? selectedNode.source_ref?.line}
                      </dd>
                    </div>
                    <div>
                      <dt>Symbol</dt>
                      <dd>{selectedNode.symbol ?? "n/a"}</dd>
                    </div>
                    <div>
                      <dt>Section</dt>
                      <dd>{selectedNode.section ?? "n/a"}</dd>
                    </div>
                  </dl>
                )}
              </DetailDrawer>
            </>
          );
        }}
      </AsyncBoundary>
    </section>
  );
}
