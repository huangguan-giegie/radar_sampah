// Design fixtures transcribed from the 03-10-2026 handoff, never a live API fallback.
import type { SeverityBand } from "../types";
export const INSIGHTS_PREVIEW = {
  asOf: "27-09-2026",
  reports: 21,
  cleanups: 8,
  joined: 46,
  needHelp: 2,
  volunteerBeachIds: ["bagan", "remis"],
  wildlife: [
    { beachId: "morib", habitat: "Mudflat", species: ["Green Sea Turtle", "Irrawaddy Dolphin"] },
    { beachId: "kelanang", habitat: "Mangrove", species: ["Irrawaddy Dolphin"] },
    { beachId: "bagan", habitat: "Seagrass", species: ["Green Sea Turtle"] },
    { beachId: "remis", habitat: "Mudflat", species: ["Irrawaddy Dolphin"] },
  ],
  beaches: [
    {
      id: "morib",
      name: "Pantai Morib",
      area: "Banting, Selangor",
      from: "High",
      to: "High",
      reports: 8,
      photo: "/home/pantai-morib.jpg",
    },
    {
      id: "bagan",
      name: "Pantai Bagan Lalang",
      area: "Sepang, Selangor",
      from: "Moderate",
      to: "High",
      reports: 4,
      photo: "/images/coastal/bagan-lalang.jpg",
    },
    {
      id: "remis",
      name: "Pantai Remis",
      area: "Jeram, Kuala Selangor",
      from: "High",
      to: "Moderate",
      reports: 9,
      photo: null,
    },
    {
      id: "kelanang",
      name: "Pantai Kelanang",
      area: "Kuala Langat, Selangor",
      from: null,
      to: null,
      reports: 0,
      photo: null,
    },
  ] as {
    id: string;
    name: string;
    area: string;
    from: SeverityBand | null;
    to: SeverityBand | null;
    reports: number;
    photo: string | null;
  }[],
  monthlyReports: [0, 1, 0, 2, 1, 0, 2, 1, 3, 1, 2, 4],
  composition: [
    ["Plastic", 31],
    ["Fishing gear", 24],
    ["Glass", 18],
    ["Metal", 12],
    ["Paper", 9],
    ["Other", 6],
  ] as [string, number][],
  participation: {
    all: [46, 32, 25],
    morib: [18, 13, 10],
    bagan: [14, 10, 8],
  } as Record<string, number[]>,
  remaining: [
    ["Fishing gear", 58],
    ["Plastic", 41],
    ["Glass", 22],
  ] as [string, number][],
  handling: [
    ["Collected for disposal", 64],
    ["Recycled / handled", 21],
    ["Not recorded", 15],
  ] as [string, number][],
};
