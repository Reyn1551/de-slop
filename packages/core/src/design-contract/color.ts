// Color parsing for the contract engine. Every accepted notation normalizes to
// sRGB `#rrggbb`, which is what the WCAG math and the design-slop rules compare
// against.

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  orange: '#ffa500',
  purple: '#800080',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  navy: '#000080',
  teal: '#008080',
  olive: '#808000',
  maroon: '#800000',
  lime: '#00ff00',
  aqua: '#00ffff',
  cyan: '#00ffff',
  fuchsia: '#ff00ff',
  magenta: '#ff00ff',
  transparent: '#00000000',
};

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function toHex(value: number): string {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
}

function hueToRgb(p: number, q: number, t: number): number {
  let hue = t;
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return p + (q - p) * 6 * hue;
  if (hue < 1 / 2) return q;
  if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
  return p;
}

function fromHsl(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360 / 360;
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);
  if (s === 0) {
    const channel = toHex(l * 255);
    return `#${channel}${channel}${channel}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, h + 1 / 3);
  const g = hueToRgb(p, q, h);
  const b = hueToRgb(p, q, h - 1 / 3);
  return `#${toHex(r * 255)}${toHex(g * 255)}${toHex(b * 255)}`;
}

function fromOklch(lightness: number, chroma: number, hue: number): string {
  const h = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(h);
  const b = chroma * Math.sin(h);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const encoded = linear.map((channel) => {
    const value = clamp(channel, 0, 1);
    return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  });

  return `#${encoded.map((channel) => toHex(channel * 255)).join('')}`;
}

function parseAlpha(text: string | undefined): string | null {
  if (text === undefined) return null;
  const trimmed = text.trim();
  const value = trimmed.endsWith('%') ? Number(trimmed.slice(0, -1)) / 100 : Number(trimmed);
  if (Number.isNaN(value)) return null;
  return toHex(clamp(value, 0, 1) * 255);
}

/** Normalize any supported color notation to `#rrggbb` or `#rrggbbaa`. */
export function normalizeColor(input: string): string | null {
  const value = input.trim().toLowerCase();

  const named = NAMED[value];
  if (named !== undefined) return named;

  if (/^#[0-9a-f]{3,8}$/.test(value)) {
    const body = value.slice(1);
    if (body.length === 3) return `#${body.split('').map((character) => character + character).join('')}`;
    if (body.length === 4) {
      const expanded = body.split('').map((character) => character + character).join('');
      return `#${expanded}`;
    }
    if (body.length === 6 || body.length === 8) return `#${body}`;
    return null;
  }

  const rgb = /^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(value);
  if (rgb) {
    const channel = (text: string): number =>
      text.endsWith('%') ? (Number(text.slice(0, -1)) / 100) * 255 : Number(text);
    const alpha = parseAlpha(rgb[4]);
    return `#${toHex(channel(rgb[1]))}${toHex(channel(rgb[2]))}${toHex(channel(rgb[3]))}${alpha ?? ''}`;
  }

  const hsl = /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(value);
  if (hsl) {
    const alpha = parseAlpha(hsl[4]);
    return `${fromHsl(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100)}${alpha ?? ''}`;
  }

  const oklch = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)$/.exec(value);
  if (oklch) {
    const lightness = oklch[1].endsWith('%') ? Number(oklch[1].slice(0, -1)) / 100 : Number(oklch[1]);
    const alpha = parseAlpha(oklch[4]);
    return `${fromOklch(lightness, Number(oklch[2]), Number(oklch[3]))}${alpha ?? ''}`;
  }

  return null;
}

/** WCAG 2.x relative luminance of an `#rrggbb` color. */
export function relativeLuminance(hex: string): number {
  const body = hex.replace('#', '').slice(0, 6);
  if (body.length !== 6) return 0;
  const channels = [0, 2, 4].map((offset) => parseInt(body.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(foreground: string, background: string): number {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

/** Strip alpha so two colors compare on their visible RGB. */
export function opaque(hex: string): string {
  return hex.slice(0, 7);
}
