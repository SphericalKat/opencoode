export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MenuPlacement =
  | "bottom-start"
  | "bottom-end"
  | "top-start"
  | "top-end";

interface Size {
  width: number;
  height: number;
}

interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface MenuPosition {
  left: number;
  top: number;
  maxHeight: number;
  origin: { x: "left" | "right"; y: "top" | "bottom" };
}

const DEFAULT_GUTTER = 4;
const DEFAULT_MARGIN = 8;

export const placeMenu = ({
  anchor,
  menu,
  window,
  insets,
  placement,
  gutter = DEFAULT_GUTTER,
  margin = DEFAULT_MARGIN,
  maxHeight = Number.POSITIVE_INFINITY,
}: {
  anchor: Rect;
  menu: Size;
  window: Size;
  insets: Insets;
  placement: MenuPlacement;
  gutter?: number;
  margin?: number;
  maxHeight?: number;
}): MenuPosition => {
  const floor = insets.top + margin;
  const ceiling = window.height - insets.bottom - margin;
  const spaceBelow = Math.max(0, ceiling - (anchor.y + anchor.height + gutter));
  const spaceAbove = Math.max(0, anchor.y - gutter - floor);
  const prefersBelow = placement.startsWith("bottom");
  const preferredSpace = prefersBelow ? spaceBelow : spaceAbove;
  const otherSpace = prefersBelow ? spaceAbove : spaceBelow;
  const flipped = menu.height > preferredSpace && otherSpace > preferredSpace;
  const below = prefersBelow !== flipped;
  const limit = Math.min(maxHeight, below ? spaceBelow : spaceAbove);
  const height = Math.min(menu.height, limit);
  const top = below
    ? anchor.y + anchor.height + gutter
    : Math.max(floor, anchor.y - gutter - height);
  const isStart = placement.endsWith("start");
  const left = isStart ? anchor.x : anchor.x + anchor.width - menu.width;
  const minLeft = insets.left + margin;
  const maxLeft = window.width - insets.right - margin - menu.width;
  return {
    left: Math.max(minLeft, Math.min(left, maxLeft)),
    maxHeight: limit,
    origin: { x: isStart ? "left" : "right", y: below ? "top" : "bottom" },
    top,
  };
};
