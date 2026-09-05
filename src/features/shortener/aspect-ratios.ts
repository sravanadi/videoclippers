export type AspectRatioOption = {
  id: string;
  label: string;
  ratio: number;
};

export const DEFAULT_ASPECT_RATIO = 16 / 9;
export const DEFAULT_ASPECT_RATIO_ID = "16:9";

export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "1:1", label: "1:1", ratio: 1 / 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
];

export const resolveAspectRatio = (id: string) =>
  ASPECT_RATIO_OPTIONS.find((option) => option.id === id)?.ratio ??
  DEFAULT_ASPECT_RATIO;
