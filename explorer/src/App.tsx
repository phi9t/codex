import { Cpu, Orbit, Puzzle, Wrench } from "lucide-react";
import { type ComponentType, type ReactElement, useState } from "react";

import { HacksExplorer } from "./hacks/HacksExplorer";
import { SubagentsExplorer } from "./subagents/SubagentsExplorer";
import { SubsystemExplorer } from "./subsystems/SubsystemExplorer";
import { TurnLifecycleExplorer } from "./lifecycle/TurnLifecycleExplorer";

type Family = "lifecycle" | "subagents" | "subsystems" | "hacks";

type FamilyConfig = {
  id: Family;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
};

const familyConfigs: FamilyConfig[] = [
  {
    id: "lifecycle",
    icon: Orbit,
    label: "Lifecycle",
    description:
      "Follow a user turn across surfaces, core session flow, tools, execution, and persisted events.",
  },
  {
    id: "subagents",
    icon: Cpu,
    label: "Subagents",
    description:
      "Map the collaboration control plane from spawn decisions through mailbox and protocol events.",
  },
  {
    id: "subsystems",
    icon: Puzzle,
    label: "Subsystems",
    description:
      "Scan the source areas that anchor the guide and generated architecture manifests.",
  },
  {
    id: "hacks",
    icon: Wrench,
    label: "Hacks",
    description:
      "Browse runnable probes by numbered band, command, and execution safety.",
  },
];

const shellInfo =
  "A source-linked technical map for the Codex turn lifecycle, sub-agent control plane, and probe catalog.";

function App() {
  const [activeFamily, setActiveFamily] = useState<Family>("lifecycle");

  const activeConfig = familyConfigs.find((family) => family.id === activeFamily) ?? familyConfigs[0];

  const familyComponents: Record<Family, ReactElement> = {
    lifecycle: <TurnLifecycleExplorer />,
    subagents: <SubagentsExplorer />,
    subsystems: <SubsystemExplorer />,
    hacks: <HacksExplorer />,
  };

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <main className="technical-map-shell">
        <div className="explorer-container">
          <header className="explorer-header">
            <div>
              <p className="eyebrow">Architecture Map</p>
              <h1>Codex Explorer</h1>
              <p>{shellInfo}</p>
            </div>
            <nav aria-label="Architecture families" className="family-switcher">
              {familyConfigs.map((family) => {
                const Icon = family.icon;
                const active = family.id === activeFamily;
                return (
                  <button
                    key={family.id}
                    type="button"
                    className={`family-switch-btn${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => setActiveFamily(family.id)}
                  >
                    <Icon className="switch-icon" aria-hidden />
                    <span>{family.label}</span>
                  </button>
                  );
                })}
            </nav>
          </header>

          <section id="main-content" className="panel">
            <div className="panel-title-row">
              <h2>{activeConfig.label}</h2>
              <p>{activeConfig.description}</p>
            </div>
            {familyComponents[activeFamily]}
          </section>
        </div>
      </main>
    </>
  );
}

export default App;
