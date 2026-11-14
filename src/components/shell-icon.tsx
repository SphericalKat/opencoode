import React from "react";
import { Platform } from "react-native";
import Svg, { Path } from "react-native-svg";

export type ShellIconName =
  | "menu"
  | "close"
  | "chevron"
  | "chevron-up-down"
  | "back"
  | "compose"
  | "more"
  | "server"
  | "refresh"
  | "eye"
  | "eye-off"
  | "search"
  | "check"
  | "folder"
  | "folder-add"
  | "archive"
  | "dots"
  | "arrow-down"
  | "copy"
  | "warning"
  | "chevron-down"
  | "chevron-up"
  | "chevron-grabber-vertical"
  | "open-file"
  | "plus"
  | "arrow-up"
  | "stop"
  | "return"
  | "sliders"
  | "terminal"
  | "list"
  | "info"
  | "branch";

interface Glyph {
  viewBox: 16 | 20 | 24;
  paths: string[];
  strokeWidth: number;
  linecap: "round" | "square";
  fill?: boolean;
}

// Each path keeps the coordinate space of its source icon, so `viewBox` declares that space.
const glyphs: Record<ShellIconName, Glyph> = {
  menu: {
    viewBox: 24,
    paths: ["M4 7h16M4 12h11M4 17h16"],
    strokeWidth: 1.5,
    linecap: "round",
  },
  close: {
    viewBox: 24,
    paths: ["m6 6 12 12M18 6 6 18"],
    strokeWidth: 1.5,
    linecap: "round",
  },
  chevron: {
    viewBox: 24,
    paths: ["m9 5 7 7-7 7"],
    strokeWidth: 1.5,
    linecap: "round",
  },
  "chevron-up-down": {
    viewBox: 24,
    paths: ["m8 9 4-4 4 4m-8 6 4 4 4-4"],
    strokeWidth: 1.5,
    linecap: "round",
  },
  back: {
    viewBox: 24,
    paths: ["M20 12H4m8-8-8 8 8 8"],
    strokeWidth: 1.8,
    linecap: "round",
  },
  compose: {
    viewBox: 24,
    paths: [
      "M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7M16 3l5 5-10 10H6v-5L16 3Z",
    ],
    strokeWidth: 1.5,
    linecap: "round",
  },
  more: {
    viewBox: 24,
    paths: [
      "M3.6 12a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0Z",
      "M10.6 12a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0Z",
      "M17.6 12a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0Z",
    ],
    // The dots are filled shapes, so they have no stroke.
    strokeWidth: 0,
    linecap: "round",
    fill: true,
  },
  server: {
    viewBox: 24,
    paths: [
      "M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z",
      "M4 12h16M8 8h1M8 16h1",
    ],
    strokeWidth: 1.5,
    linecap: "round",
  },
  refresh: {
    viewBox: 24,
    paths: ["M20 7v5h-5M20 12a8 8 0 1 0-2.3 5.7"],
    strokeWidth: 1.5,
    linecap: "round",
  },
  eye: {
    viewBox: 24,
    paths: [
      "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z",
      "M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0Z",
    ],
    strokeWidth: 1.5,
    linecap: "round",
  },
  "eye-off": {
    viewBox: 24,
    paths: [
      "m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3 3.9M6.1 6.1A23 23 0 0 0 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2",
    ],
    strokeWidth: 1.5,
    linecap: "round",
  },
  search: {
    viewBox: 24,
    paths: ["M4 10.5a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0Z", "M16 16l4 4"],
    strokeWidth: 1.5,
    linecap: "round",
  },
  check: {
    viewBox: 16,
    paths: ["M3.536 8.179L6.393 11.75L12.465 4.25"],
    strokeWidth: 1,
    linecap: "square",
  },
  folder: {
    viewBox: 16,
    paths: ["M1.333 2V13.333H14.667V4H8.667L6.667 2H1.333Z"],
    strokeWidth: 1,
    linecap: "square",
  },
  "folder-add": {
    viewBox: 16,
    paths: [
      "M7.5 13.333H1.5V2H6.833L8.833 4H14.833V6M10.167 11.333H15.5M12.833 8.667V14",
    ],
    strokeWidth: 1,
    linecap: "square",
  },
  archive: {
    viewBox: 16,
    paths: ["M2.9 5.6V13.6H13.1V5.6M1.6 2.4H14.4V5.6H1.6ZM6.2 8.2H9.8"],
    strokeWidth: 1,
    linecap: "square",
  },
  dots: {
    viewBox: 16,
    paths: ["M2.5 7.5h1v1h-1ZM7.5 7.5h1v1h-1ZM12.5 7.5h1v1h-1Z"],
    strokeWidth: 1,
    linecap: "square",
  },
  "arrow-down": {
    viewBox: 16,
    paths: ["M12.3333 8.66665L8 13L3.66667 8.66665M8 12.6667V2.83332"],
    strokeWidth: 1,
    linecap: "square",
  },
  copy: {
    viewBox: 16,
    paths: [
      "M3.5 5h6a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 2 12.5v-6A1.5 1.5 0 0 1 3.5 5Z",
      "M5 5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-2",
    ],
    strokeWidth: 1.2,
    linecap: "round",
  },
  warning: {
    viewBox: 16,
    paths: [
      "M10.6667 1.33325H5.33272L1.33334 5.33325L1.33342 10.6917L5.3327 14.691L10.6667 14.6909L14.6911 10.6917V5.33255L10.6667 1.33325Z",
      "M8 10.6667H8.00667",
      "M8 7.99992V5.33325",
    ],
    strokeWidth: 1,
    linecap: "square",
  },
  "chevron-down": {
    viewBox: 20,
    paths: ["M6.6665 8.33325L9.99984 11.6666L13.3332 8.33325"],
    strokeWidth: 1,
    linecap: "square",
  },
  "chevron-up": {
    viewBox: 20,
    paths: ["M6.6665 11.6666L9.99984 8.33325L13.3332 11.6666"],
    strokeWidth: 1,
    linecap: "square",
  },
  "chevron-grabber-vertical": {
    viewBox: 20,
    paths: [
      "M6.66675 12.4998L10.0001 15.8332L13.3334 12.4998M6.66675 7.49984L10.0001 4.1665L13.3334 7.49984",
    ],
    strokeWidth: 1,
    linecap: "square",
  },
  "open-file": {
    viewBox: 20,
    paths: [
      "M7.91602 2.91406H2.91602V17.0807H17.0827V12.0807M12.0827 2.91406H17.0827V7.91406M9.58268 10.4141L16.666 3.33073",
    ],
    strokeWidth: 1,
    linecap: "square",
  },
  plus: {
    viewBox: 20,
    paths: ["M10 5.417V14.583M5.417 10H14.583"],
    strokeWidth: 1,
    linecap: "square",
  },
  "arrow-up": {
    viewBox: 24,
    paths: ["M12 19V5M6 11l6-6 6 6"],
    strokeWidth: 1.6,
    linecap: "round",
  },
  stop: {
    viewBox: 24,
    paths: ["M7 7h10v10H7Z"],
    strokeWidth: 1.6,
    linecap: "round",
    fill: true,
  },
  return: {
    viewBox: 24,
    paths: ["M20 4v7a4 4 0 0 1-4 4H4M9 10l-5 5 5 5"],
    strokeWidth: 1.6,
    linecap: "round",
  },
  terminal: {
    viewBox: 16,
    paths: ["M1.5 2.5H14.5V13.5H1.5ZM4 6L6.5 8L4 10M8 10.5H11.5"],
    strokeWidth: 1,
    linecap: "square",
  },
  list: {
    viewBox: 16,
    paths: ["M2 4H3M2 8H3M2 12H3M5.5 4H14M5.5 8H14M5.5 12H14"],
    strokeWidth: 1,
    linecap: "square",
  },
  info: {
    viewBox: 16,
    paths: [
      "M8 14C11.314 14 14 11.314 14 8C14 4.686 11.314 2 8 2C4.686 2 2 4.686 2 8C2 11.314 4.686 14 8 14ZM8 7.5V11M8 5V5.5",
    ],
    strokeWidth: 1,
    linecap: "square",
  },
  branch: {
    viewBox: 16,
    paths: ["M4.5 2.5V13.5M11.5 3V6.5C11.5 8.5 4.5 7.5 4.5 10"],
    strokeWidth: 1,
    linecap: "square",
  },
  sliders: {
    viewBox: 24,
    paths: ["M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4"],
    strokeWidth: 1.6,
    linecap: "round",
  },
};

export const ShellIcon = ({
  name,
  color,
  size = 20,
}: {
  name: ShellIconName;
  color: string;
  size?: number;
}) => {
  if (name === "back" && Platform.OS === "ios") {
    return (
      <Svg
        width={size / 2}
        height={size}
        viewBox="0 0 12 24"
        fill="none"
        aria-hidden
      >
        <Path
          d="m11 2-10 10 10 10"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  const glyph = glyphs[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${glyph.viewBox} ${glyph.viewBox}`}
      fill="none"
      aria-hidden
    >
      {glyph.paths.map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={glyph.strokeWidth}
          strokeLinecap={glyph.linecap}
          strokeLinejoin="round"
          fill={glyph.fill ? color : "none"}
        />
      ))}
    </Svg>
  );
};
