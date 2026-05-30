import { useEffect, useState } from "react";

import { fetchExplorerJson, errorMessage } from "../lib/fetch";
import { AsyncBoundary, type AsyncState } from "../explorer-kit/AsyncBoundary";
import { DetailDrawer } from "../explorer-kit/DetailDrawer";

type SubagentNode = {
  id: string;
  label: string;
  group: string;
  file?: string;
};

type SubagentEdge = {
  from: string;
  to: string;
  label: string;
  kind: string;
};

type SubagentManifest = {
  nodes: SubagentNode[];
  edges: SubagentEdge[];
  warnings?: string[];
};

type PositionedSubagentNode = SubagentNode & {
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

const subagentLanes: GraphLane[] = [
  { id: "root", label: "Root thread" },
  { id: "control", label: "Control plane" },
  { id: "runtime", label: "Collaboration runtime" },
  { id: "projection", label: "Projection" },
];

const nodeHeight = 58;
const nodeWidth = 204;
const rowSpacing = 108;
const columnSpacing = 260;
const laneHeaderHeight = 46;
const sourceRoot = "https://github.com/phi9t/codex/blob/phi9t-mainline";
const subagentGuideHref = `${sourceRoot}/CODEX_HACKERS_GUIDE.md#14-sub-agents-and-collaboration`;

const subagentDeepDives: Record<string, string> = {
  "root-thread":
    "The root thread is the user-facing session that requests collaboration work and owns the parent side of spawned agent communication.",
  "agent-control":
    "AgentControl coordinates lifecycle operations for spawned collaborators and is the entry point for control-plane actions.",
  registry:
    "AgentRegistry owns spawn slots, parent-child relationships, depth checks, and lookup of running collaboration agents.",
  "child-thread":
    "The child thread runs the collaborator turn with isolated task context while still reporting progress through the parent thread.",
  mailbox:
    "Mailbox is the delivery boundary for messages exchanged with a collaborator so control flow does not depend on direct task internals.",
  "event-mapping":
    "The app-server event mapper projects collaboration tool-call events into thread items clients can display consistently.",
};

function laneForSubagentNode(node: SubagentNode): GraphLane {
  if (node.id === "root-thread") {
    return subagentLanes[0];
  }
  if (node.id === "agent-control" || node.id === "registry") {
    return subagentLanes[1];
  }
  if (node.id === "child-thread" || node.id === "mailbox") {
    return subagentLanes[2];
  }
  return subagentLanes[3];
}

function groupColors(group: string): string {
  if (group === "control") {
    return "#1de3d5";
  }
  if (group === "thread") {
    return "#6aa6ff";
  }
  if (group === "message") {
    return "#ff8bd6";
  }
  if (group === "protocol") {
    return "#a3ff9e";
  }
  return "#9f86ff";
}

function edgeColor(kind: string): string {
  if (kind === "call") {
    return "#45d0ff";
  }
  if (kind === "state") {
    return "var(--execution)";
  }
  if (kind === "spawn") {
    return "#9cff87";
  }
  if (kind === "message") {
    return "#ff8bbf";
  }
  if (kind === "event") {
    return "#cfaaff";
  }
  return "var(--text-muted)";
}

function layoutSubagentGraph(
  nodes: SubagentNode[],
  edges: SubagentEdge[],
): {
  nodes: PositionedSubagentNode[];
  width: number;
  height: number;
} {
  const byId = new Map<string, SubagentNode>();
  for (const node of nodes) {
    byId.set(node.id, node);
  }

  const outgoing = new Map<string, SubagentEdge[]>();
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

  const roots = [...indegree.entries()]
    .filter(([, incoming]) => incoming === 0)
    .map(([id]) => id);

  const depthById = new Map<string, number>();
  const depthBumpsById = new Map<string, number>();
  for (const root of roots) {
    depthById.set(root, 0);
  }

  const maxDepth = Math.max(1, nodes.length);
  const pending = [...roots];
  while (pending.length > 0) {
    const currentId = pending.shift();
    if (currentId === undefined) {
      continue;
    }

    const currentDepth = depthById.get(currentId) ?? 0;
    const outgoingEdges = outgoing.get(currentId) ?? [];
    for (const outgoingEdge of outgoingEdges) {
      const nextDepth = currentDepth + 1;
      if (nextDepth > maxDepth) {
        continue;
      }

      const existingDepth = depthById.get(outgoingEdge.to) ?? 0;
      if (nextDepth > existingDepth) {
        depthById.set(outgoingEdge.to, nextDepth);
        const updateCount = (depthBumpsById.get(outgoingEdge.to) ?? 0) + 1;
        depthBumpsById.set(outgoingEdge.to, updateCount);

        if (updateCount <= maxDepth) {
          pending.push(outgoingEdge.to);
        }
      }
    }
  }

  const byLane = new Map<string, string[]>();
  for (const node of nodes) {
    const lane = laneForSubagentNode(node);
    const layer = byLane.get(lane.id) ?? [];
    layer.push(node.id);
    byLane.set(lane.id, layer);
  }

  const positioned: PositionedSubagentNode[] = [];
  for (const lane of subagentLanes) {
    const nodeIds = byLane.get(lane.id) ?? [];
    nodeIds.sort(
      (left, right) => (depthById.get(left) ?? 0) - (depthById.get(right) ?? 0),
    );
    for (let index = 0; index < nodeIds.length; index += 1) {
      const id = nodeIds[index];
      const node = byId.get(id);
      if (node === undefined) {
        continue;
      }
      const laneIndex = subagentLanes.findIndex((candidate) => candidate.id === lane.id);
      const positionedNode: PositionedSubagentNode = {
        ...node,
        width: nodeWidth,
        height: nodeHeight,
        x: 24 + laneIndex * columnSpacing,
        y: laneHeaderHeight + 22 + index * rowSpacing,
        depth: depthById.get(node.id) ?? 0,
        index,
        lane,
      };
      positioned.push(positionedNode);
    }
  }

  return {
    nodes: positioned,
    width: Math.max(700, positioned.reduce((max, node) => Math.max(max, node.x + node.width), 0) + 32),
    height: Math.max(260, positioned.reduce((max, node) => Math.max(max, node.y + node.height), 0) + 116),
  };
}

function renderEdge(
  from: PositionedSubagentNode,
  to: PositionedSubagentNode,
  edge: SubagentEdge,
  edgeIndex: number,
) {
  const isSameLane = from.lane.id === to.lane.id;
  if (isSameLane) {
    const centerX = from.x + from.width / 2;
    const startY = from.y + from.height;
    const endY = to.y;
    const d = `M ${centerX} ${startY} L ${centerX} ${endY}`;
    return (
      <g key={`${from.id}-${to.id}-${edgeIndex}`}>
        <path
          d={d}
          stroke={edgeColor(edge.kind)}
          strokeWidth={1.45}
          fill="none"
          markerEnd="url(#arrow-subagents)"
        />
        {renderEdgeMarker(centerX, (startY + endY) / 2, edgeIndex + 1)}
      </g>
    );
  }

  const isBackwardEdge = to.x < from.x;
  const startX = isBackwardEdge ? from.x : from.x + from.width;
  const startY = from.y + from.height / 2;
  const endX = isBackwardEdge ? to.x + to.width : to.x;
  const endY = to.y + to.height / 2;
  const routeY = Math.max(startY, endY) + 46 + (edgeIndex % 3) * 20;
  const midX = startX + Math.max(28, (endX - startX) / 2);
  const d = isBackwardEdge
    ? `M ${startX} ${startY} L ${startX - 18} ${startY} L ${startX - 18} ${routeY} L ${endX + 18} ${routeY} L ${endX + 18} ${endY} L ${endX} ${endY}`
    : `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
  const markerX = isBackwardEdge ? (startX + endX) / 2 : midX;
  const markerY = isBackwardEdge ? routeY : (startY + endY) / 2;

  return (
    <g key={`${from.id}-${to.id}-${edgeIndex}`}>
      <path
        d={d}
        stroke={edgeColor(edge.kind)}
        strokeWidth={1.5}
        fill="none"
        markerEnd="url(#arrow-subagents)"
      />
      {renderEdgeMarker(markerX, markerY, edgeIndex + 1)}
    </g>
  );
}

function renderEdgeMarker(x: number, y: number, index: number): React.ReactElement {
  return (
    <g className="graph-edge-marker" aria-hidden>
      <circle cx={x} cy={y} r={10} />
      <text x={x} y={y + 3} textAnchor="middle">
        {index}
      </text>
    </g>
  );
}

function formatGroupOrder(groups: string[]): string[] {
  return [...groups].sort((left, right) => left.localeCompare(right));
}

function basename(path: string | undefined): string {
  if (path === undefined) {
    return "file unknown";
  }
  return path.split("/").at(-1) ?? path;
}

function sourceHref(node: SubagentNode): string | undefined {
  if (node.file === undefined) {
    return undefined;
  }
  return `${sourceRoot}/${node.file}`;
}

function subagentDeepDive(node: SubagentNode): string {
  return subagentDeepDives[node.id] ?? "This node participates in the Codex collaboration control plane described by the sub-agent guide section.";
}

export function SubagentsExplorer(): React.ReactElement {
  const [manifestState, setManifestState] = useState<AsyncState<SubagentManifest>>({
    status: "loading",
  });
  const [selectedNode, setSelectedNode] = useState<SubagentNode | null>(null);

  useEffect(() => {
    let active = true;
    void fetchExplorerJson<SubagentManifest>("subagents.json")
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
    <section className="explorer-view" aria-label="Subagents view">
      <AsyncBoundary state={manifestState}>
        {(manifest) => {
          const graph = layoutSubagentGraph(manifest.nodes, manifest.edges);
          const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
          const activeNode =
            selectedNode ?? graph.nodes.find((node) => node.id === "agent-control") ?? graph.nodes[0] ?? null;
          const activeSourceHref = activeNode === null ? undefined : sourceHref(activeNode);
          const groupedNodes = new Map<string, SubagentNode[]>();
          for (const node of manifest.nodes) {
            const bucket = groupedNodes.get(node.group) ?? [];
            bucket.push(node);
            groupedNodes.set(node.group, bucket);
          }

          return (
            <>
              <div className="graph-wrap">
                <svg
                  className="graph-svg"
                  viewBox={`0 0 ${graph.width} ${graph.height}`}
                  preserveAspectRatio="xMinYMin meet"
                  role="img"
                  aria-label="Subagent node graph"
                >
                  <defs>
                    <marker
                      id="arrow-subagents"
                      markerWidth="10"
                      markerHeight="10"
                      refX="8"
                      refY="3"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0,0 L0,6 L8,3 z" fill="#6bc5ff" />
                    </marker>
                  </defs>
                  <g className="graph-swimlanes">
                    {subagentLanes.map((lane, index) => (
                      <g key={lane.id} className="graph-lane">
                        <rect
                          x={12 + index * columnSpacing}
                          y={10}
                          width={columnSpacing - 24}
                          height={graph.height - 24}
                          rx={8}
                          ry={8}
                        />
                        <text x={24 + index * columnSpacing} y={34} className="graph-lane__label">
                          {lane.label}
                        </text>
                      </g>
                    ))}
                  </g>
                  <g>
                    {manifest.edges.flatMap((edge, edgeIndex) => {
                      const source = nodeById.get(edge.from);
                      const target = nodeById.get(edge.to);
                      if (source === undefined || target === undefined) {
                        return [];
                      }
                      return renderEdge(source, target, edge, edgeIndex);
                    })}
                  </g>
                  {graph.nodes.map((node) => (
                    <g
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      className={`graph-node ${selectedNode?.id === node.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedNode(node)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedNode(node);
                        }
                      }}
                      aria-label={`Open details for ${node.label}`}
                    >
                      <rect
                        x={node.x}
                        y={node.y}
                        width={node.width}
                        height={node.height}
                        rx={10}
                        ry={10}
                        fill="transparent"
                        className="graph-node__box"
                        style={{ stroke: groupColors(node.group) }}
                      />
                      <text x={node.x + 12} y={node.y + 23} className="graph-node__label">
                        {node.label}
                      </text>
                      <text x={node.x + 12} y={node.y + 42} className="graph-node__meta">
                        {node.group} · {basename(node.file)}
                      </text>
                      <title>{node.label}</title>
                    </g>
                  ))}
                </svg>
              </div>
              <div className="subagent-legend" aria-label="Subagent groups">
                {formatGroupOrder([...groupedNodes.keys()]).map((group) => (
                  <span key={group} className="subagent-pill">
                    <span
                      className="subagent-pill__swatch"
                      style={{ backgroundColor: groupColors(group) }}
                    />
                    {group}
                  </span>
                ))}
              </div>
              <div className="relationship-strip" aria-label="Subagent relationships">
                {manifest.edges.map((edge, index) => (
                  <span key={`${edge.from}-${edge.to}-${edge.label}`} className="relationship-chip">
                    <strong>{index + 1}</strong>
                    <span>{edge.label}</span>
                    <small>{edge.kind}</small>
                  </span>
                ))}
              </div>
              <ul className="source-list">
                {(manifest.warnings ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <section className="deep-dive-panel" aria-label="Subagent code deep dive">
                {activeNode === null ? (
                  <p>No subagent node available.</p>
                ) : (
                  <>
                    <header>
                      <p className="eyebrow">Code deep dive</p>
                      <h3>{activeNode.label}</h3>
                    </header>
                    <p>{subagentDeepDive(activeNode)}</p>
                    <dl className="detail-grid">
                      <div>
                        <dt>Implementation</dt>
                        <dd>
                          {activeSourceHref === undefined ? (
                            "Source location unavailable"
                          ) : (
                            <a href={activeSourceHref} target="_blank" rel="noreferrer">
                              {activeNode.file}
                            </a>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Group</dt>
                        <dd>{activeNode.group}</dd>
                      </div>
                      <div>
                        <dt>Guide</dt>
                        <dd>
                          <a href={subagentGuideHref} target="_blank" rel="noreferrer">
                            CODEX_HACKERS_GUIDE.md §14
                          </a>
                        </dd>
                      </div>
                    </dl>
                  </>
                )}
              </section>
              <DetailDrawer
                isOpen={selectedNode !== null}
                title={selectedNode?.label ?? "Subagent node"}
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
                      <dt>Group</dt>
                      <dd>{selectedNode.group}</dd>
                    </div>
                    <div>
                      <dt>File</dt>
                      <dd>{selectedNode.file ?? "Unknown"}</dd>
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
