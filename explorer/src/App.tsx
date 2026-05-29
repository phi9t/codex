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
      "Track architecture states across request initialization, execution, and shutdown.",
  },
  {
    id: "subagents",
    icon: Cpu,
    label: "Subagents",
    description:
      "Inspect active sub-agent families and their assigned tasks without going into full detail.",
  },
  {
    id: "subsystems",
    icon: Puzzle,
    label: "Subsystems",
    description:
      "Surface subsystem slices and map how responsibilities are separated at runtime.",
  },
  {
    id: "hacks",
    icon: Wrench,
    label: "Hacks",
    description:
      "Display hack patterns and temporary workarounds with context and lifecycle impact.",
  },
];

const shellInfo =
  "The shell stays constant while each family renders its live architecture data from manifest JSON.";

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
      <main className="observatory-bg">
        <div className="explorer-container">
          <header className="explorer-header">
            <div>
              <p className="eyebrow">Architecture Explorer</p>
              <h1>Codex Observatory</h1>
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
