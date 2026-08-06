// Structured interviewing, the Greenhouse lesson: every panelist measures
// something specific, nobody measures the same thing twice, and open concerns
// get probed on purpose. Deterministic: criteria round-robin across the panel,
// the primary concern assigned to the first panelist.

export interface KitEntry {
  panelist: string;
  focus: string[];
}

export function buildInterviewKit(
  requiredCriteria: string[],
  concerns: string[],
  panelists: string[]
): KitEntry[] {
  if (panelists.length === 0) return [];
  const entries: KitEntry[] = panelists.map((p) => ({ panelist: p, focus: [] }));
  requiredCriteria.forEach((c, i) => {
    entries[i % entries.length].focus.push(c);
  });
  if (concerns[0]) {
    entries[0].focus.push(`Probe: ${concerns[0]}`);
  }
  return entries.filter((e) => e.focus.length > 0);
}
