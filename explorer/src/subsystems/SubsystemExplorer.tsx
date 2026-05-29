import { useEffect, useState } from "react";

import { fetchExplorerJson, errorMessage } from "../lib/fetch";
import { AsyncBoundary, type AsyncState } from "../explorer-kit/AsyncBoundary";

type SourceRef = {
  file: string;
  line: number;
};

type ComponentManifest = {
  source_refs: SourceRef[];
};

type GroupedSourceArea = {
  area: string;
  refs: SourceRef[];
};

function areaFromSourceRef(ref: SourceRef): string {
  const parts = ref.file.split("/");
  if (parts.length > 1) {
    return `${parts[0]}/${parts[1]}`;
  }

  return ref.file;
}

function sortSourceRefs(refs: SourceRef[]): SourceRef[] {
  return [...refs].sort((left, right) =>
    left.file === right.file ? left.line - right.line : left.file.localeCompare(right.file),
  );
}

export function SubsystemExplorer(): React.ReactElement {
  const [manifestState, setManifestState] = useState<AsyncState<ComponentManifest>>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    void fetchExplorerJson<ComponentManifest>("components.json")
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
    <section className="explorer-view" aria-label="Subsystems view">
      <AsyncBoundary state={manifestState}>
        {(manifest) => {
          const grouped = new Map<string, SourceRef[]>();
          for (const ref of manifest.source_refs) {
            const area = areaFromSourceRef(ref);
            const bucket = grouped.get(area) ?? [];
            bucket.push(ref);
            grouped.set(area, bucket);
          }

          const areas = [...grouped.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map<GroupedSourceArea>(([area, refs]) => ({
              area,
              refs: sortSourceRefs(refs),
            }));

          return (
            <div className="subsystem-list">
              {areas.map((group) => (
                <article key={group.area} className="subsystem-card">
                  <header>
                    <h3>{group.area}</h3>
                    <p>{group.refs.length} source references</p>
                  </header>
                  <ul>
                    {group.refs.map((ref) => (
                      <li key={`${ref.file}-${ref.line}`}>
                        <code>{ref.file}</code>
                        <span>:{ref.line}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          );
        }}
      </AsyncBoundary>
    </section>
  );
}
