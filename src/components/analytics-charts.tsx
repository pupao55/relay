"use client";

// Chart colors: status palette validated for CVD safety (3-slot: emerald/amber/red
// passes adjacent-pair checks; identity is never color-alone — every chart has a
// legend or single named series plus tooltips).

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BLUE = "#3b82f6";
const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const GRID = "var(--border)";
const MUTED_TEXT = "#737373";

const axisProps = {
  tick: { fontSize: 11, fill: MUTED_TEXT },
  axisLine: { stroke: "transparent" },
  tickLine: { stroke: "transparent" },
} as const;

const tooltipStyle = {
  contentStyle: {
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
  },
  cursor: { fill: "rgb(0 0 0 / 0.04)" },
} as const;

export function BlockedOverTimeChart({ data }: { data: { day: string; blocked: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip {...tooltipStyle} cursor={{ stroke: MUTED_TEXT, strokeDasharray: "3 3" }} />
        <Line
 isAnimationActive={false}
                   type="monotone"
          dataKey="blocked"
          name="Blocked or at-risk candidates"
          stroke={RED}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function OverdueByOwnerChart({ data }: { data: { owner: string; overdue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis type="category" dataKey="owner" {...axisProps} width={92} />
        <Tooltip {...tooltipStyle} />
        <Bar
 isAnimationActive={false}
                   dataKey="overdue"
          name="Overdue actions"
          fill={AMBER}
          barSize={14}
          radius={[0, 4, 4, 0]}
          label={{ position: "right", fontSize: 11, fill: MUTED_TEXT }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StageWaitChart({
  data,
}: {
  data: { stage: string; avgHours: number; slaHours: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 32, left: -18 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="stage"
          {...axisProps}
          angle={-28}
          textAnchor="end"
          interval={0}
          height={58}
        />
        <YAxis {...axisProps} unit="h" />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11.5 }} iconSize={10} />
        <Bar isAnimationActive={false}
          dataKey="avgHours" name="Avg time in stage (h)" fill={BLUE} barSize={16} radius={[4, 4, 0, 0]} />
        <Line isAnimationActive={false}
          dataKey="slaHours" name="SLA (h)" stroke={MUTED_TEXT} strokeDasharray="5 4" strokeWidth={2} dot={false} type="stepAfter" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ConversionChart({ data }: { data: { stage: string; reached: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 0, left: 24 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis type="category" dataKey="stage" {...axisProps} width={130} />
        <Tooltip {...tooltipStyle} />
        <Bar
 isAnimationActive={false}
                   dataKey="reached"
          name="Applications reaching stage"
          fill={BLUE}
          barSize={14}
          radius={[0, 4, 4, 0]}
          label={{ position: "right", fontSize: 11, fill: MUTED_TEXT }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MomentumByRoleChart({
  data,
}: {
  data: { role: string; moving: number; slowing: number; blocked: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44 + 50)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 40 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis type="category" dataKey="role" {...axisProps} width={150} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11.5 }} iconSize={10} />
        <Bar isAnimationActive={false}
          dataKey="moving" name="Moving" stackId="m" fill={EMERALD} barSize={16} stroke="var(--card)" strokeWidth={2} />
        <Bar isAnimationActive={false}
          dataKey="slowing" name="Slowing" stackId="m" fill={AMBER} stroke="var(--card)" strokeWidth={2} />
        <Bar isAnimationActive={false}
          dataKey="blocked" name="Blocked / at risk" stackId="m" fill={RED} stroke="var(--card)" strokeWidth={2} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
