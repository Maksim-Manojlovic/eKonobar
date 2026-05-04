"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const WAITER_LABELS: Record<string, string> = {
  punctuality:        "Tačnost",
  skill:              "Veštine",
  guestCommunication: "Komunikacija",
  personalHygiene:    "Higijena",
  teamwork:           "Tim",
  speed:              "Brzina",
};

const VENUE_LABELS: Record<string, string> = {
  atmosphere:      "Atmosfera",
  organization:    "Organizacija",
  pay:             "Isplata",
  tips:            "Bakšiš",
  hygieneStandards:"Higijena",
  management:      "Menadžment",
};

interface TrustRadarProps {
  type: "waiter" | "venue";
  scores: Record<string, number>;
  size?: number;
}

export default function TrustRadar({ type, scores, size = 260 }: TrustRadarProps) {
  const labels = type === "waiter" ? WAITER_LABELS : VENUE_LABELS;

  const data = Object.entries(labels).map(([key, label]) => ({
    subject: label,
    value: Math.round(scores[key] ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid stroke="#f0efec" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: "#737373", fontSize: 11, fontWeight: 600 }}
        />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#f97316"
          fill="#f97316"
          fillOpacity={0.18}
          strokeWidth={2}
          dot={{ r: 3, fill: "#f97316" }}
        />
        <Tooltip
          formatter={(v: number) => [`${v}/100`, "Score"]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #f0efec",
            fontSize: 12,
            fontWeight: 600,
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
