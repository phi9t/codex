import { ChevronRight, Cpu, Orbit, Puzzle, Wrench } from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";

type Family = "lifecycle" | "subagents" | "subsystems" | "hacks";

type FamilyConfig = {
  id: Family;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  summary: string[];
  placeholder: string;
};

const familyConfigs: FamilyConfig[] = [
  {
    id: "lifecycle",
    icon: Orbit,
    label: "Lifecycle",
    description:
      "Track architecture states across request initialization, execution, and shutdown.",
    summary: [
      "Turn lifecycle graph overview",
      "State transition timeline",
      "Key lifecycle event stream",
    ],
    placeholder:
      "Lifecycle views will show current run phases, state ownership, and phase transitions.",
  },
  {
    id: "subagents",
    icon: Cpu,
    label: "Subagents",
    description:
      "Inspect active subagent families and their assigned tasks without going into full detail.",
    summary: [
      "Subagent registry and health",
      "Dependency and parent links",
      "Recent activity summary",
    ],
    placeholder:
      "Subagent cards and filters are intentionally minimal here while full details are handled in the next task.",
  },
  {
    id: "subsystems",
    icon: Puzzle,
    label: "Subsystems",
    description:
      "Surface subsystem slices and map how responsibilities are separated at runtime.",
    summary: [
      "Subsystem list and status",
      "Topology and ownership pointers",
      "Telemetry stubs for load and error count",
    ],
    placeholder:
      "Subsystem data is represented with compact placeholders to keep the shell stable for Task 7 implementation.",
  },
  {
    id: "hacks",
    icon: Wrench,
    label: "Hacks",
    description:
      "Display hack patterns and temporary workarounds with context and lifecycle impact.",
    summary: [
      "Hack catalog and impact tags",
      "Scope and deprecation timing",
      "Migration notes and owners",
    ],
    placeholder:
      "Hacks are currently summarized as grouped placeholders pending detailed view components.",
  },
];

const shellInfo =
  "The Observatory shell is intentionally compact: switch a family to reveal summary placeholders while Task 7 adds full detail views.";

function App() {
  const [activeFamily, setActiveFamily] = useState<Family>("lifecycle");

  const activeConfig = familyConfigs.find((family) => family.id === activeFamily) ?? familyConfigs[0];

  return (
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

        <section className="panel">
          <div className="panel-title-row">
            <h2>{activeConfig.label}</h2>
            <p>{activeConfig.description}</p>
          </div>
          <ul className="panel-summary" aria-label={`${activeConfig.label} summary`}>
            {activeConfig.summary.map((item) => (
              <li key={item}>
                <ChevronRight className="summary-icon" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="panel-placeholder">{activeConfig.placeholder}</p>
        </section>
      </div>
    </main>
  );
}

export default App;
