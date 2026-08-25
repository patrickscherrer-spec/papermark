export function asDataroomCardLayout(v: any) {
  return v || "LIST";
}

export function asDataroomViewerHeaderStyle(v: any) {
  return v || "DEFAULT";
}

export function inferDataroomViewerLayoutPreset() {
  return "STANDARD";
}

export const CARD_LAYOUT_OPTIONS = [
  { value: "LIST", label: "List" },
  { value: "COMPACT", label: "Compact" },
  { value: "GRID", label: "Grid" },
];