const sixDigitHex = /^#[0-9a-f]{6}$/iu;
const eightDigitHex = /^#[0-9a-f]{8}$/iu;
const maxChannel = 255;
const alphaOffset = 7;

const toHexByte = (value: number) =>
  Math.min(maxChannel, Math.max(0, Math.round(value)))
    .toString(16)
    .padStart(2, "0");

export const withAlpha = (hex: string, alpha: number): string => {
  if (sixDigitHex.test(hex)) {
    return `${hex}${toHexByte(alpha * maxChannel)}`;
  }
  if (eightDigitHex.test(hex)) {
    const existing = Number.parseInt(hex.slice(alphaOffset), 16);
    return `${hex.slice(0, alphaOffset)}${toHexByte(existing * alpha)}`;
  }
  return hex;
};
