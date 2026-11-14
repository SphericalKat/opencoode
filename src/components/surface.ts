import type { BoxShadowValue } from "react-native";

export const radius = {
  lg: 8,
  md: 6,
  sheet: 16,
  sm: 4,
  xl: 10,
  xxl: 12,
} as const;

export type ElevationName =
  | "raised"
  | "floating"
  | "overlay"
  | "input"
  | "buttonNeutral";

type Elevations = Readonly<Record<ElevationName, readonly BoxShadowValue[]>>;

const light: Elevations = {
  raised: [
    { offsetX: 0, offsetY: 2, blurRadius: 4, color: "#0000000a" },
    {
      offsetX: 0,
      offsetY: 1,
      blurRadius: 2,
      spreadDistance: -1,
      color: "#00000014",
    },
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0.5,
      color: "#0000001f",
    },
  ],
  floating: [
    { offsetX: 0, offsetY: 8, blurRadius: 16, color: "#0000000a" },
    { offsetX: 0, offsetY: 4, blurRadius: 8, color: "#00000014" },
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0.5,
      color: "#0000001f",
    },
  ],
  overlay: [
    { offsetX: 0, offsetY: 16, blurRadius: 32, color: "#0000000a" },
    { offsetX: 0, offsetY: 8, blurRadius: 16, color: "#00000014" },
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0.5,
      color: "#0000001f",
    },
  ],
  input: [
    { offsetX: 0, offsetY: 1, blurRadius: 1.5, color: "#0000001a" },
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0.5,
      color: "#00000024",
    },
  ],
  buttonNeutral: [
    { offsetX: 0, offsetY: 1, blurRadius: 1.5, color: "#0000001a" },
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0.5,
      color: "#00000024",
    },
  ],
};
const top = (color: string) => ({
  offsetX: 0,
  offsetY: -0.5,
  blurRadius: 0,
  color,
});
const dark: Elevations = {
  raised: [
    { offsetX: 0, offsetY: 2, blurRadius: 4, color: "#0000004d" },
    { offsetX: 0, offsetY: 1, blurRadius: 2, color: "#0000004d" },
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0.5,
      color: "#ffffff29",
    },
    top("#ffffff0f"),
  ],
  floating: [
    { offsetX: 0, offsetY: 8, blurRadius: 16, color: "#0000004d" },
    { offsetX: 0, offsetY: 4, blurRadius: 8, color: "#0000004d" },
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0.5,
      color: "#ffffff29",
    },
    top("#ffffff0f"),
  ],
  overlay: [
    { offsetX: 0, offsetY: 16, blurRadius: 32, color: "#0000004d" },
    { offsetX: 0, offsetY: 8, blurRadius: 16, color: "#0000004d" },
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0.5,
      color: "#ffffff29",
    },
    top("#ffffff0f"),
  ],
  input: [
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0.5,
      color: "#ffffff29",
    },
    top("#ffffff0f"),
  ],
  buttonNeutral: [
    { offsetX: 0, offsetY: 1, blurRadius: 2, color: "#00000066" },
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0.5,
      color: "#ffffff33",
    },
    top("#ffffff1a"),
  ],
};
export const elevation = (scheme: "light" | "dark"): Elevations =>
  scheme === "light" ? light : dark;
