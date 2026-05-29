import { useEffect, useState } from "react";

import { fetchExplorerJson, errorMessage } from "../lib/fetch";
import { AsyncBoundary, type AsyncState } from "../explorer-kit/AsyncBoundary";

type Hack = {
  id: string;
  title: string;
  band: string;
  kind: string;
  gated: boolean;
  command: string;
};

type ComponentManifest = {
  hacks: Hack[];
};

export function HacksExplorer(): React.ReactElement {
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
    <section className="explorer-view" aria-label="Hacks view">
      <AsyncBoundary state={manifestState}>
        {(manifest) => {
          const groupedHacks = new Map<string, Hack[]>();
          for (const hack of manifest.hacks) {
            const bucket = groupedHacks.get(hack.band) ?? [];
            bucket.push(hack);
            groupedHacks.set(hack.band, bucket);
          }

          return (
            <div className="hack-sections">
              {[...groupedHacks.entries()]
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([band, hacks]) => (
                  <article key={band} className="hack-band">
                    <header>
                      <h3>Band {band}</h3>
                      <p>{hacks.length} hacks</p>
                    </header>
                    <div className="hack-grid">
                      {hacks.map((hack) => (
                        <article className="hack-item" key={hack.id}>
                          <p className="hack-item__title">
                            #{hack.id} — {hack.title}
                          </p>
                          <dl className="detail-grid">
                            <div>
                              <dt>Command</dt>
                              <dd>
                                <code>{hack.command}</code>
                              </dd>
                            </div>
                            <div>
                              <dt>Kind</dt>
                              <dd>{hack.kind}</dd>
                            </div>
                            <div>
                              <dt>Gated</dt>
                              <dd>{hack.gated ? "Yes" : "No"}</dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  </article>
                ))}
            </div>
          );
        }}
      </AsyncBoundary>
    </section>
  );
}
