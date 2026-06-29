// Build-time accent shade helper (mirrors the original config.js logic).
export function shadeHex(hex: string, pct: number): string {
  hex = String(hex || "").replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length !== 6) return "#" + hex;
  const n = parseInt(hex, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, p = pct / 100;
  const adj = (c: number) => Math.max(0, Math.min(255, Math.round(c + (p < 0 ? c * p : (255 - c) * p))));
  return "#" + [adj(r), adj(g), adj(b)].map((x) => ("0" + x.toString(16)).slice(-2)).join("");
}
