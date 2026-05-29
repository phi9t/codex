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
};

const lifecycleNodeHeight = 68;
const verticalSpacing = 120;
const horizontalSpacing = 360;
const textWidth = (text: string) => Math.max(160, text.length * 8 + 32);

function edgeColor(kind: string): string {
  switch (kind) {
    case "call":
      return "var(--color-cyan)";
    case "state":
      return "var(--color-amber)";
    case "spawn":
      return "#9dffb3";
    case "message":
      return "#6bc5ff";
    case "event":
      return "#d7a8ff";
    default:
      return "var(--color-muted)";
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
  for (const id of queue) {
    depthById.set(id, 0);
  }

  for (const id of queue) {
    const sourceDepth = depthById.get(id) ?? 0;
    const nextEdges = outgoing.get(id) ?? [];
    for (const edge of nextEdges) {
      const current = depthById.get(edge.to) ?? 0;
      if (sourceDepth + 1 > current) {
        depthById.set(edge.to, sourceDepth + 1);
      }
    }
  }

  const layered = new Map<number, string[]>();
  for (const node of nodes) {
    const depth = depthById.get(node.id) ?? 0;
    const layer = layered.get(depth) ?? [];
    layer.push(node.id);
    layered.set(depth, layer);
  }

  const positioned: PositionedLifecycleNode[] = [];
  const byNodeId = new Map<string, PositionedLifecycleNode>();

  for (const [depth, nodeIds] of layered) {
    for (let index = 0; index < nodeIds.length; index += 1) {
      const id = nodeIds[index];
      const node = byId.get(id);
      if (node === undefined) {
        continue;
      }
      const width = textWidth(node.label);
      const positionedNode: PositionedLifecycleNode = {
        ...node,
        width,
        height: lifecycleNodeHeight,
        x: 24 + depth * horizontalSpacing,
        y: 20 + index * verticalSpacing,
        depth,
        index,
      };
      positioned.push(positionedNode);
      byNodeId.set(node.id, positionedNode);
    }
  }

  const maxX = positioned.reduce(
    (max, node) => Math.max(max, node.x + node.width),
    0,
  );
  const maxY = positioned.reduce((max, node) => Math.max(max, node.y + node.height), 0);

  return {
    nodes: positioned,
    width: Math.max(700, maxX + 80),
    height: Math.max(260, maxY + 80),
  };
}

function renderLifecycleEdge(
  from: PositionedLifecycleNode,
  to: PositionedLifecycleNode,
  index: number,
  edge: LifecycleEdge,
) {
  const startX = from.x + from.width;
  const startY = from.y + from.height / 2;
  const endX = to.x;
  const endY = to.y + to.height / 2;

  const delta = Math.max(30, Math.abs(endX - startX) / 2);
  const ctrl1X = endX > startX ? startX + delta : startX - delta;
  const ctrl2X = endX > startX ? endX - delta : endX + delta;

  const d = `M ${startX} ${startY} C ${ctrl1X} ${startY}, ${ctrl2X} ${endY}, ${endX} ${endY}`;
  const labelY = (startY + endY) / 2;
  const labelX = (startX + endX) / 2;

  return (
    <g key={`${from.id}-${to.id}-${index}`}>
      <path d={d} stroke={edgeColor(edge.kind)} fill="none" strokeWidth={1.5} markerEnd="url(#arrow)" />
      <text
        x={labelX}
        y={labelY - 5}
        className="graph-edge-label"
        textAnchor="middle"
      >
        {edge.label}
      </text>
      <text x={labelX} y={labelY + 12} className="graph-edge-kind" textAnchor="middle">
        {edge.kind}
      </text>
    </g>
  );
}

function sortLifecycleWarnings(warnings: string[]): string[] {
  return [...warnings].sort((left, right) => left.localeCompare(right));
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
                          rx={10}
                          ry={10}
                          className="graph-node__box"
                        />
                        <text x={node.x + 12} y={node.y + 28} className="graph-node__label">
                          {node.label}
                        </text>
                        <text x={node.x + 12} y={node.y + 48} className="graph-node__meta">
                          {node.file ?? "No file"}:{node.line ?? "?"}
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
