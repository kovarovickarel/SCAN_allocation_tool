import { Profiler, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemberAvailabilityModal } from "../../src/components/features/MemberAvailabilityModal";
import { AvailabilityMemberRow, EMPTY_TEAMS, type CalendarDay, type CalendarAbsences } from "../../src/components/features/AvailabilityCalendarRows";
import { ThemeContext, TOOLS } from "../../src/constants";
import type { TeamMemberRecord } from "../../src/types";
import "../../src/index.css";
const params = new URLSearchParams(location.search), count = Number(params.get("count")) || 40, global = params.get("global") !== "false";
const metrics = { commits: [] as number[], names: { alice: 0, bob: 0 }, capacities: { alice: 0, bob: 0 }, saved: null as unknown };
(window as any).__availabilityPerformance = metrics;
const members = Array.from({ length: count }, (_, i) => ({ id: `member${i}`, firstName: `Member${i}`, lastName: "Example", tool: global ? TOOLS[i % (TOOLS.length - 1)].name : "KPI", role: "engineering" as const, fte: 1, footprint: ["PRA", "BIE", "CHE", "TRO", "CAI", "TOK"][i % 6], absences: {} }));
localStorage.setItem(`scan-availability-position:${global ? "Global" : "KPI"}`, JSON.stringify({ year: 2026, left: 0, top: 0 }));
const days: CalendarDay[] = Array.from({ length: 365 }, (_, i) => {
  const date = new Date(Date.UTC(2026,0,i+1)); return { date: date.toISOString().slice(0,10), month: date.getUTCMonth(), day: date.getUTCDate() };
});
const probeMembers = ["alice", "bob"].map(id => ({ id, get firstName() { metrics.names[id]++; return id === "alice" ? "Alice" : "Bob"; }, lastName: "Example", tool: "KPI", role: "engineering", footprint: "PRA", get fte() { metrics.capacities[id]++; return 1; } } as TeamMemberRecord));
const empty: CalendarAbsences = {}, emptyHolidays: string[] = [], noop = () => {};
function Isolation() {
  const [absences, setAbsences] = useState(empty), [paint, setPaint] = useState<"vacation" | "sick">("vacation"), [holidays, setHolidays] = useState(emptyHolidays);
  const reset = () => { metrics.names = { alice: 0, bob: 0 }; metrics.capacities = { alice: 0, bob: 0 }; };
  return <>
    <button onClick={() => { reset(); setAbsences({ "2026-01-05": "vacation" }); }}>Edit Alice</button>
    <button onClick={() => { reset(); setPaint("sick"); }}>Change paint</button>
    <button onClick={() => { reset(); setHolidays(["2026-01-06"]); }}>Add holiday</button>
    <button onClick={() => { reset(); setAbsences(empty); }}>Clear Alice</button>
    <button onClick={() => { reset(); setAbsences({ "2026-01-05": { type: "vacation", halfDay: true } }); }}>Half Alice</button>
    {probeMembers.map((member, i) => <AvailabilityMemberRow key={member.id} member={member} absences={i === 0 ? absences : empty} holidays={holidays} days={days} year={2026} global={false} isCrossTeam={false} teams={EMPTY_TEAMS} paint={paint} halfDay={false} isRetro={false} onBegin={noop} onKeyboard={noop} />)}
  </>;
}
createRoot(document.getElementById("root")!).render(<ThemeContext.Provider value={{ theme: "vibrant", mode: "extended", isRetro: false, isBasic: false, isBasicMode: false }}>
{params.has("isolation") ? <Isolation /> : <Profiler id="calendar" onRender={(_id, phase, actualDuration) => { if (phase !== "mount") metrics.commits.push(actualDuration); }}>
<MemberAvailabilityModal global={global} toolName={global ? "Global" : "KPI"} members={members} allMembers={members} holidays={{}} onClose={() => {}} onSave={(absences, holidays) => { metrics.saved = { absences, holidays }; }} />
</Profiler>}
</ThemeContext.Provider>);
