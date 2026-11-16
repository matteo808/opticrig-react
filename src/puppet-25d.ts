import type { OpticPoseState } from './rig-math.ts';
import type { OpticAvatarSpec, OpticUniverseId } from './types.ts';

interface CachedSprite {
  img: HTMLImageElement;
  ready: boolean;
  error: boolean;
}

const spriteImageCache = new Map<string, CachedSprite>();
let pixelBufferCanvas: HTMLCanvasElement | null = null;
let pixelBufferCtx: CanvasRenderingContext2D | null = null;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function adjustHex(hex: string, delta: number): string {
  const clean = (hex || '#1E293B').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex || '#1E293B';
  const r = clamp(Number.parseInt(clean.slice(0, 2), 16) + delta, 0, 255);
  const g = clamp(Number.parseInt(clean.slice(2, 4), 16) + delta, 0, 255);
  const b = clamp(Number.parseInt(clean.slice(4, 6), 16) + delta, 0, 255);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#38BDF8').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(56,189,248,${alpha})`;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  fill: string,
) {
  const innerR = outerR * 0.34;
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 4;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function getOrLoadSprite(url: string | null | undefined, onLoaded?: () => void): CachedSprite | null {
  if (!url) return null;
  const existing = spriteImageCache.get(url);
  if (existing) {
    return existing;
  }
  if (typeof Image === 'undefined') return null;

  const entry: CachedSprite = { img: new Image(), ready: false, error: false };
  if (!url.startsWith('data:') && !url.startsWith('blob:')) {
    entry.img.crossOrigin = 'anonymous';
  }
  entry.img.onload = () => {
    entry.ready = true;
    onLoaded?.();
  };
  entry.img.onerror = () => {
    entry.error = true;
  };
  entry.img.src = url;
  spriteImageCache.set(url, entry);
  return entry;
}

export function preloadPuppetCustomImages(spec: OpticAvatarSpec, onLoaded?: () => void): void {
  const sprites = spec.customSprites;
  if (!sprites) return;
  getOrLoadSprite(sprites.idleUrl, onLoaded);
  getOrLoadSprite(sprites.talkUrl, onLoaded);
  getOrLoadSprite(sprites.blinkUrl, onLoaded);
  getOrLoadSprite(sprites.talkBlinkUrl, onLoaded);
}

function drawSoftGroundShadow(ctx: CanvasRenderingContext2D, y = 294, w = 78) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(160, y, w, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAnimeOutfit(
  ctx: CanvasRenderingContext2D,
  spec: OpticAvatarSpec,
  xCenter: number,
  neckBottomY: number,
) {
  const outfit = spec.outfit ?? 'oversized-hoodie';
  if (outfit === 'none') return;

  const shirtColor = spec.bodyColor || '#1E293B';
  const darkColor = adjustHex(shirtColor, -34);
  const accent = spec.accentColor || '#38BDF8';
  const secondary = spec.secondaryColor || '#FDE68A';
  const outline = adjustHex(shirtColor, -72);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Torso / Shoulders base
  ctx.fillStyle = shirtColor;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(xCenter - 84, 304);
  ctx.quadraticCurveTo(xCenter - 78, neckBottomY + 12, xCenter - 30, neckBottomY - 2);
  ctx.lineTo(xCenter + 30, neckBottomY - 2);
  ctx.quadraticCurveTo(xCenter + 78, neckBottomY + 12, xCenter + 84, 304);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (outfit === 'oversized-hoodie') {
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.ellipse(xCenter, neckBottomY + 8, 42, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hoodie strings
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 3.5;
    [-16, 16].forEach((dx) => {
      ctx.beginPath();
      ctx.moveTo(xCenter + dx, neckBottomY + 14);
      ctx.lineTo(xCenter + dx * 1.15, neckBottomY + 46);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(xCenter + dx * 1.15, neckBottomY + 48, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (outfit === 'cyber-jacket') {
    // High collar & glowing cyber seams
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(xCenter - 44, neckBottomY - 8);
    ctx.lineTo(xCenter - 26, neckBottomY + 26);
    ctx.lineTo(xCenter + 26, neckBottomY + 26);
    ctx.lineTo(xCenter + 44, neckBottomY - 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Neon chest zip lines
    ctx.beginPath();
    ctx.moveTo(xCenter - 42, neckBottomY + 26);
    ctx.lineTo(xCenter - 48, 298);
    ctx.moveTo(xCenter + 42, neckBottomY + 26);
    ctx.lineTo(xCenter + 48, 298);
    ctx.stroke();
  } else if (outfit === 'academy-blazer') {
    // White shirt V + ribbon/tie
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(xCenter - 24, neckBottomY);
    ctx.lineTo(xCenter, neckBottomY + 46);
    ctx.lineTo(xCenter + 24, neckBottomY);
    ctx.closePath();
    ctx.fill();

    // Ribbon / Bowtie
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(xCenter, neckBottomY + 14);
    ctx.lineTo(xCenter - 18, neckBottomY + 6);
    ctx.lineTo(xCenter - 14, neckBottomY + 24);
    ctx.closePath();
    ctx.moveTo(xCenter, neckBottomY + 14);
    ctx.lineTo(xCenter + 18, neckBottomY + 6);
    ctx.lineTo(xCenter + 14, neckBottomY + 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.arc(xCenter, neckBottomY + 14, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (outfit === 'cozy-sweater') {
    ctx.fillStyle = adjustHex(shirtColor, 18);
    drawRoundedRectPath(ctx, xCenter - 34, neckBottomY - 10, 68, 26, 12);
    ctx.fill();
    ctx.stroke();
  } else if (outfit === 'fantasy-cloak') {
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(xCenter - 58, neckBottomY + 6);
    ctx.quadraticCurveTo(xCenter, neckBottomY + 34, xCenter + 58, neckBottomY + 6);
    ctx.lineTo(xCenter + 74, neckBottomY + 40);
    ctx.quadraticCurveTo(xCenter, neckBottomY + 62, xCenter - 74, neckBottomY + 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(xCenter, neckBottomY + 26, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (outfit === 'streetwear-tee') {
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(xCenter, neckBottomY + 2, 26, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTopAccessoryPuppet(
  ctx: CanvasRenderingContext2D,
  spec: OpticAvatarSpec,
  pose: OpticPoseState,
  cx: number,
  topY: number,
  headHalfW: number,
) {
  const acc = spec.accessory;
  if (!acc || acc === 'none') return;

  const accent = spec.accentColor || '#38BDF8';
  const secondary = spec.secondaryColor || '#FDE68A';
  const hairCol = spec.hairColor || spec.bodyColor || '#1E293B';
  const earWiggle = Math.sin(pose.accessorySpin * 3.1) * 0.05 + pose.mouthOpen * 0.07;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (acc === 'neko-ears' || acc === 'cat-ears') {
    [-1, 1].forEach((dir) => {
      ctx.save();
      ctx.translate(cx + dir * (headHalfW * 0.62), topY + 14);
      ctx.rotate(dir * (0.28 + earWiggle));
      ctx.fillStyle = acc === 'neko-ears' ? hairCol : spec.bodyColor;
      ctx.strokeStyle = acc === 'neko-ears' ? adjustHex(hairCol, -65) : accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-22, 12);
      ctx.quadraticCurveTo(0, -44, 2, -40);
      ctx.quadraticCurveTo(22, -6, 20, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner pink/accent ear
      ctx.fillStyle = acc === 'neko-ears' ? '#FDA4AF' : accent;
      ctx.beginPath();
      ctx.moveTo(-10, 6);
      ctx.lineTo(0, -24);
      ctx.lineTo(10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  } else if (acc === 'fox-ears') {
    [-1, 1].forEach((dir) => {
      ctx.save();
      ctx.translate(cx + dir * (headHalfW * 0.58), topY + 10);
      ctx.rotate(dir * (0.34 + earWiggle));
      ctx.fillStyle = hairCol;
      ctx.strokeStyle = adjustHex(hairCol, -70);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-22, 16);
      ctx.lineTo(0, -56);
      ctx.lineTo(24, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // White fox ear tip + warm inner
      ctx.fillStyle = '#FFF7ED';
      ctx.beginPath();
      ctx.moveTo(-8, -28);
      ctx.lineTo(0, -54);
      ctx.lineTo(9, -28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FDBA74';
      ctx.beginPath();
      ctx.moveTo(-10, 10);
      ctx.lineTo(0, -18);
      ctx.lineTo(10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  } else if (acc === 'demon-horns') {
    [-1, 1].forEach((dir) => {
      ctx.save();
      ctx.translate(cx + dir * (headHalfW * 0.52), topY + 8);
      ctx.fillStyle = accent;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dir * -10, 8);
      ctx.quadraticCurveTo(dir * 24, -18, dir * 16, -42);
      ctx.quadraticCurveTo(dir * 6, -16, dir * 8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  } else if (acc === 'angel-halo' || acc === 'halo-ring') {
    const floatHalo = Math.sin(pose.accessorySpin * 2.5) * 4;
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 6;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(cx, topY - 24 + floatHalo, 44, 11, pose.headRoll * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (acc === 'witch-hat') {
    ctx.save();
    ctx.translate(cx, topY + 2);
    ctx.fillStyle = '#1E1B4B';
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 3;
    // Brim
    ctx.beginPath();
    ctx.ellipse(0, 6, headHalfW + 30, 15, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Cone
    ctx.beginPath();
    ctx.moveTo(-headHalfW * 0.65, 6);
    ctx.quadraticCurveTo(-18, -52, 22, -74);
    ctx.quadraticCurveTo(26, -34, headHalfW * 0.65, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Ribbon + buckle
    ctx.strokeStyle = accent;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-headHalfW * 0.58, -4);
    ctx.lineTo(headHalfW * 0.58, -4);
    ctx.stroke();
    ctx.fillStyle = secondary;
    drawRoundedRectPath(ctx, -10, -11, 20, 14, 3);
    ctx.fill();
    ctx.restore();
  } else if (acc === 'gamer-beanie') {
    ctx.fillStyle = accent;
    ctx.strokeStyle = adjustHex(accent, -65);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, topY + 26, headHalfW * 0.92, Math.PI * 1.04, -0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Folded cuff
    ctx.fillStyle = adjustHex(accent, -25);
    drawRoundedRectPath(ctx, cx - headHalfW * 0.94, topY + 14, headHalfW * 1.88, 18, 8);
    ctx.fill();
    ctx.stroke();
    // Pompom
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.arc(cx, topY - headHalfW * 0.54, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (acc === 'frog-leaf') {
    ctx.save();
    ctx.translate(cx + 8, topY - 4);
    ctx.rotate(Math.sin(pose.accessorySpin * 2) * 0.08);
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.quadraticCurveTo(-2, -14, 6, -18);
    ctx.stroke();
    ctx.fillStyle = '#4ADE80';
    ctx.strokeStyle = '#14532D';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(4, -16);
    ctx.quadraticCurveTo(32, -32, 34, -8);
    ctx.quadraticCurveTo(18, -2, 4, -16);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (acc === 'royal-crown') {
    const fy = topY - 4 + Math.sin(pose.accessorySpin * 2) * 2;
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#854D0E';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 26, fy + 10);
    ctx.lineTo(cx - 32, fy - 22);
    ctx.lineTo(cx - 12, fy - 4);
    ctx.lineTo(cx, fy - 30);
    ctx.lineTo(cx + 12, fy - 4);
    ctx.lineTo(cx + 32, fy - 22);
    ctx.lineTo(cx + 26, fy + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cx, fy - 4, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (acc === 'twin-antennas' || acc === 'antenna-pin') {
    const dirs = acc === 'twin-antennas' ? [-1, 1] : [1];
    dirs.forEach((dir) => {
      ctx.strokeStyle = secondary;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx + dir * 28, topY + 6);
      ctx.lineTo(cx + dir * 42, topY - 30);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx + dir * 42, topY - 32, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore();
}

function drawSideAddonsPuppet(
  ctx: CanvasRenderingContext2D,
  spec: OpticAvatarSpec,
  pose: OpticPoseState,
  cx: number,
  eyeY: number,
  headHalfW: number,
  mouthY: number,
) {
  const addon = spec.sideAddon ?? 'none';
  if (addon === 'none') return;

  const accent = spec.accentColor || '#38BDF8';
  const secondary = spec.secondaryColor || '#FDE68A';

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (addon === 'studio-headphones' || addon === 'mic-boom') {
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, eyeY - 4, headHalfW + 10, Math.PI * 1.05, -0.05);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    [-1, 1].forEach((dir) => {
      const cupX = cx + dir * (headHalfW + 8) - 10;
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      drawRoundedRectPath(ctx, cupX, eyeY - 20, 20, 46, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      drawRoundedRectPath(ctx, cupX + 6, eyeY - 10, 8, 24, 4);
      ctx.fill();
    });

    if (addon === 'mic-boom') {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(cx - headHalfW - 4, eyeY + 18);
      ctx.quadraticCurveTo(cx - headHalfW * 0.5, mouthY + 8, cx - 10, mouthY + 4);
      ctx.stroke();
      ctx.fillStyle = accent;
      drawRoundedRectPath(ctx, cx - 18, mouthY - 1, 14, 10, 5);
      ctx.fill();
    }
  } else if (addon === 'round-glasses') {
    const gap = 30 * spec.eyeSpacing;
    ctx.strokeStyle = secondary;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    [-gap, gap].forEach((dx) => {
      ctx.beginPath();
      ctx.arc(cx + dx, eyeY, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(cx - gap + 21, eyeY);
    ctx.quadraticCurveTo(cx, eyeY - 4, cx + gap - 21, eyeY);
    ctx.stroke();
  } else if (addon === 'cyber-visor-shades') {
    ctx.fillStyle = hexToRgba(accent, 0.28);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3.5;
    drawRoundedRectPath(ctx, cx - 64, eyeY - 18, 128, 36, 12);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 46, eyeY - 12);
    ctx.lineTo(cx - 26, eyeY + 10);
    ctx.stroke();
  } else if (addon === 'floating-sparkles') {
    const s = pose.accessorySpin;
    drawFourPointStar(ctx, cx - headHalfW - 22, eyeY - 28 + Math.sin(s * 2.8) * 6, 11, accent);
    drawFourPointStar(ctx, cx + headHalfW + 24, eyeY + 8 + Math.cos(s * 2.4) * 6, 9, secondary);
    drawFourPointStar(ctx, cx + headHalfW + 10, eyeY - 54 + Math.sin(s * 3.1) * 4, 7, accent);
  }

  ctx.restore();
}

function drawEmotionMarks(ctx: CanvasRenderingContext2D, spec: OpticAvatarSpec, pose: OpticPoseState, cx: number, cy: number) {
  const exp = spec.defaultExpression;
  if (exp === 'insight') {
    drawFourPointStar(ctx, cx + 62, cy - 58, 12, '#FACC15');
    drawFourPointStar(ctx, cx + 78, cy - 42, 7, '#FEF08A');
  } else if (exp === 'skeptical') {
    // Anime sweatdrop
    ctx.save();
    ctx.fillStyle = '#38BDF8';
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 56, cy - 34);
    ctx.quadraticCurveTo(cx + 66, cy - 18, cx + 56, cy - 12);
    ctx.quadraticCurveTo(cx + 46, cy - 18, cx + 56, cy - 34);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (exp === 'warning') {
    // Anime anger mark
    ctx.save();
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    const mx = cx + 54;
    const my = cy - 44;
    [
      [mx - 10, my - 2, mx - 2, my - 10],
      [mx + 10, my - 2, mx + 2, my - 10],
      [mx - 10, my + 4, mx - 2, my + 12],
      [mx + 10, my + 4, mx + 2, my + 12],
    ].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();
    });
    ctx.restore();
  } else if (exp === 'approve') {
    drawFourPointStar(ctx, cx - 64, cy - 48, 10, '#F472B6');
    drawFourPointStar(ctx, cx + 64, cy - 48, 10, '#F472B6');
  }
  void pose;
}

function drawAnimeEye(
  ctx: CanvasRenderingContext2D,
  spec: OpticAvatarSpec,
  pose: OpticPoseState,
  x: number,
  y: number,
  scaleY: number,
  side: -1 | 1,
) {
  const style = spec.eyeStyle;
  const accent = spec.accentColor || '#38BDF8';
  const secondary = spec.secondaryColor || '#FDE68A';
  const darkInk = '#1E1B2E';

  if (style === 'happy-arcs' || scaleY < 0.22) {
    ctx.save();
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y + 4, 15, Math.PI * 1.1, -Math.PI * 0.1);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style === 'kawaii-dots') {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, scaleY);
    ctx.fillStyle = darkInk;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10.5, 13.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-3.5, -4.5, 4.5, 0, Math.PI * 2);
    ctx.arc(3.5, 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const eyeW = 18;
  const eyeH = 22;
  const gx = pose.eyeLookX * 4;
  const gy = pose.eyeLookY * 3;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, scaleY);

  // Sclera
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(0, 0, eyeW, eyeH * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iris clipped inside sclera
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, eyeW - 1, eyeH * 0.84, 0, 0, Math.PI * 2);
  ctx.clip();

  const irisW = style === 'anime-cat' ? 11.5 : 13.5;
  const irisH = 16.5;
  const grad = ctx.createLinearGradient(0, -irisH, 0, irisH);
  grad.addColorStop(0, adjustHex(accent, -55));
  grad.addColorStop(0.55, accent);
  grad.addColorStop(1, secondary);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(gx, gy + 1, irisW, irisH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupil / Idol Star
  if (style === 'starry-idol') {
    drawFourPointStar(ctx, gx, gy + 2, 7.5, secondary);
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(gx, gy + 1, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'anime-cat') {
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(gx, gy + 1, 3.6, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(gx, gy + 1, 6.2, 7.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Catchlights
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(gx - 5.5, gy - 6.5, 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(gx + 4.8, gy + 5.5, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // end clip

  // Crisp anime upper eyelash + wing
  ctx.strokeStyle = darkInk;
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-eyeW - 2, -2);
  ctx.quadraticCurveTo(0, -eyeH * 1.12, eyeW + 4 * side, -3);
  ctx.stroke();

  // Soft lower lash
  ctx.strokeStyle = adjustHex(darkInk, 40);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 2, eyeW * 0.72, 0.28 * Math.PI, 0.72 * Math.PI);
  ctx.stroke();

  ctx.restore();
}

function drawCharacterMouth(
  ctx: CanvasRenderingContext2D,
  spec: OpticAvatarSpec,
  mouthOpen: number,
  cx: number,
  cy: number,
) {
  const mStyle = spec.mouthStyle ?? 'anime-fang';
  if (mStyle === 'none') return;

  const outline = '#3F1D2B';
  const inside = '#881337';
  const tongue = '#FB7185';

  ctx.save();
  ctx.strokeStyle = outline;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (mStyle === 'cat-omega') {
    if (mouthOpen > 0.14) {
      const h = 6 + mouthOpen * 16;
      ctx.fillStyle = inside;
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 2);
      ctx.quadraticCurveTo(cx - 6, cy + 2, cx, cy - 4);
      ctx.quadraticCurveTo(cx + 6, cy + 2, cx + 14, cy - 2);
      ctx.quadraticCurveTo(cx + 10, cy + h, cx, cy + h);
      ctx.quadraticCurveTo(cx - 10, cy + h, cx - 14, cy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2.8;
      ctx.stroke();
    } else {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx - 6.5, cy - 1, 6.5, 0.1, Math.PI - 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 6.5, cy - 1, 6.5, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (mouthOpen > 0.1) {
    const w = 13 + mouthOpen * 7;
    const h = 5 + mouthOpen * 14;
    ctx.fillStyle = inside;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy - 2);
    ctx.quadraticCurveTo(cx, cy - 4, cx + w, cy - 2);
    ctx.quadraticCurveTo(cx + w * 0.85, cy + h, cx, cy + h);
    ctx.quadraticCurveTo(cx - w * 0.85, cy + h, cx - w, cy - 2);
    ctx.closePath();
    ctx.fill();

    // Tongue
    ctx.save();
    ctx.clip();
    ctx.fillStyle = tongue;
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.72, w * 0.7, h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute white anime tooth / fang
    if (mStyle === 'anime-fang') {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(cx + 4, cy - 2);
      ctx.lineTo(cx + 9.5, cy - 2);
      ctx.lineTo(cx + 7, cy + 5.5);
      ctx.closePath();
      ctx.fill();
    } else if (mStyle === 'comic-grin') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - w, cy - 4, w * 2, 5.5);
    }
    ctx.restore();

    ctx.lineWidth = 2.8;
    ctx.stroke();
  } else {
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (mStyle === 'anime-fang') {
      ctx.arc(cx, cy - 3, 12, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(cx + 5, cy + 2);
      ctx.lineTo(cx + 9.5, cy + 2);
      ctx.lineTo(cx + 7.5, cy + 7);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.arc(cx, cy - 4, 13, 0.22 * Math.PI, 0.78 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function renderAnimePuppet(ctx: CanvasRenderingContext2D, spec: OpticAvatarSpec, pose: OpticPoseState) {
  drawSoftGroundShadow(ctx, 298, 72);

  const skin = spec.skinColor ?? '#FFE4D6';
  const skinShadow = adjustHex(skin, -26);
  const skinOutline = adjustHex(skin, -85);
  const hair = spec.hairColor ?? '#1E293B';
  const hairDark = adjustHex(hair, -32);
  const hairLight = adjustHex(hair, 36);
  const hairStyle = spec.hairStyle ?? 'messy-layers';
  const hairSway = Math.sin(pose.accessorySpin * 2.3) * 4 - pose.headYaw * 12;

  const hoverY = -pose.hoverY * 95;
  const cx = 160 + pose.headYaw * 12;
  const headY = 148 + pose.headPitch * 8 + hoverY;
  const stretch = clamp(spec.bodyStretchY ?? 1, 0.85, 1.2);
  const headHalfW = 56;
  const headH = 62 * stretch;

  ctx.save();
  ctx.translate(cx, headY);
  ctx.scale(pose.entryScale, pose.entryScale);
  ctx.rotate(pose.headRoll * 0.7);
  ctx.translate(-cx, -headY);

  // Layer 1: Back Hair
  if (hairStyle !== 'none') {
    ctx.save();
    ctx.fillStyle = hairDark;
    ctx.strokeStyle = adjustHex(hair, -75);
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    if (hairStyle === 'twin-tails') {
      [-1, 1].forEach((dir) => {
        ctx.beginPath();
        ctx.moveTo(cx + dir * 48, headY - 22);
        ctx.quadraticCurveTo(cx + dir * 102 + hairSway, headY + 34, cx + dir * 82 + hairSway * 1.4, headY + 132);
        ctx.quadraticCurveTo(cx + dir * 56 + hairSway, headY + 110, cx + dir * 56, headY + 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Scrunchie
        ctx.fillStyle = spec.accentColor || '#F472B6';
        ctx.beginPath();
        ctx.arc(cx + dir * 56, headY - 12, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hairDark;
      });
    } else if (hairStyle === 'long-flowing' || hairStyle === 'hime-bob' || hairStyle === 'wolf-cut') {
      const botY = hairStyle === 'long-flowing' ? headY + 148 : headY + 94;
      ctx.beginPath();
      ctx.moveTo(cx - 56, headY - 38);
      ctx.quadraticCurveTo(cx - 82 + hairSway, headY + 36, cx - 68 + hairSway * 1.2, botY);
      ctx.lineTo(cx + 68 + hairSway * 1.2, botY);
      ctx.quadraticCurveTo(cx + 82 + hairSway, headY + 36, cx + 56, headY - 38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (hairStyle === 'cozy-bun') {
      [-1, 1].forEach((dir) => {
        ctx.beginPath();
        ctx.arc(cx + dir * 46, headY - 56, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  // Layer 2: Outfit & Neck
  const neckBottomY = headY + headH + 10;
  drawAnimeOutfit(ctx, spec, cx, neckBottomY);
  ctx.fillStyle = skinShadow;
  drawRoundedRectPath(ctx, cx - 15, headY + headH - 12, 30, 32, 12);
  ctx.fill();

  // Layer 3: Back Top Accessories (demon horns / animal ears)
  drawTopAccessoryPuppet(ctx, spec, pose, cx, headY - headH, headHalfW);

  // Layer 4: Head Contour + Ears
  ctx.fillStyle = skin;
  ctx.strokeStyle = skinOutline;
  ctx.lineWidth = 3;
  // Side ears
  [-1, 1].forEach((dir) => {
    ctx.beginPath();
    ctx.ellipse(cx + dir * (headHalfW - 2), headY + 12, 9, 13, dir * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Anime Chibi Jaw / Face
  ctx.beginPath();
  ctx.moveTo(cx - headHalfW, headY - 10);
  ctx.bezierCurveTo(cx - headHalfW, headY - headH * 1.06, cx + headHalfW, headY - headH * 1.06, cx + headHalfW, headY - 10);
  ctx.bezierCurveTo(cx + headHalfW, headY + headH * 0.56, cx + 22, headY + headH * 0.94, cx, headY + headH);
  ctx.bezierCurveTo(cx - 22, headY + headH * 0.94, cx - headHalfW, headY + headH * 0.56, cx - headHalfW, headY - 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Layer 5: Blush + Emotion marks
  const blush = clamp(spec.blushIntensity ?? 0.55, 0, 1);
  if (blush > 0.05) {
    [-34, 34].forEach((dx) => {
      ctx.fillStyle = `rgba(251, 113, 133, ${0.42 * blush})`;
      ctx.beginPath();
      ctx.ellipse(cx + dx, headY + 22, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(244, 63, 94, ${0.55 * blush})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + dx - 4, headY + 25);
      ctx.lineTo(cx + dx - 1, headY + 19);
      ctx.moveTo(cx + dx + 2, headY + 25);
      ctx.lineTo(cx + dx + 5, headY + 19);
      ctx.stroke();
    });
  }
  drawEmotionMarks(ctx, spec, pose, cx, headY);

  // Layer 6: Eyes, Eyebrows & Nose
  const eyeXShift = pose.headYaw * 12;
  const eyeY = headY + 4 + pose.headPitch * 8;
  const eyeGap = 27 * spec.eyeSpacing;
  drawAnimeEye(ctx, spec, pose, cx - eyeGap + eyeXShift, eyeY, pose.leftEyeScaleY, -1);
  drawAnimeEye(ctx, spec, pose, cx + eyeGap + eyeXShift, eyeY, pose.rightEyeScaleY, 1);

  // Dynamic Eyebrows
  ctx.save();
  ctx.strokeStyle = adjustHex(hair, -45);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const exp = spec.defaultExpression;
  [-1, 1].forEach((dir) => {
    const bx = cx + dir * eyeGap + eyeXShift;
    let by = eyeY - 27;
    let tilt = 0;
    if (exp === 'warning') {
      by += 5;
      tilt = dir * -7;
    } else if (exp === 'skeptical') {
      by += dir === -1 ? 5 : -4;
      tilt = dir === -1 ? -4 : 3;
    } else if (exp === 'insight') {
      by -= 5;
    }
    ctx.beginPath();
    ctx.moveTo(bx - 13, by - tilt);
    ctx.quadraticCurveTo(bx, by - 4, bx + 13, by + tilt);
    ctx.stroke();
  });
  ctx.restore();

  // Tiny anime nose dot + mouth
  ctx.fillStyle = skinOutline;
  ctx.beginPath();
  ctx.arc(cx + eyeXShift * 1.1, eyeY + 18, 1.8, 0, Math.PI * 2);
  ctx.fill();

  const mouthY = headY + 34 + pose.headPitch * 9;
  drawCharacterMouth(ctx, spec, pose.mouthOpen, cx + eyeXShift * 0.9, mouthY);

  // Layer 7: Front Hair Bangs & Specular Shine
  if (hairStyle !== 'none') {
    ctx.save();
    ctx.fillStyle = hair;
    ctx.strokeStyle = adjustHex(hair, -75);
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(cx - headHalfW - 6, headY - 6);
    ctx.bezierCurveTo(
      cx - headHalfW - 10,
      headY - headH * 1.24,
      cx + headHalfW + 10,
      headY - headH * 1.24,
      cx + headHalfW + 6,
      headY - 6,
    );
    // Side locks framing cheeks
    ctx.lineTo(cx + headHalfW + 10, headY + 36);
    ctx.quadraticCurveTo(cx + headHalfW - 6, headY + 18, cx + 38, headY - 8);
    if (hairStyle === 'hime-bob') {
      ctx.lineTo(cx - 38, headY - 8);
    } else {
      ctx.quadraticCurveTo(cx + 22, headY + 10, cx + 10, headY - 12);
      ctx.quadraticCurveTo(cx, headY + 16, cx - 10, headY - 12);
      ctx.quadraticCurveTo(cx - 22, headY + 10, cx - 38, headY - 8);
    }
    ctx.quadraticCurveTo(cx - headHalfW + 6, headY + 18, cx - headHalfW - 10, headY + 36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hair highlight shine crescent
    ctx.fillStyle = hexToRgba(hairLight, 0.52);
    ctx.beginPath();
    ctx.ellipse(cx - 16, headY - headH * 0.62, 18, 5, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 18, headY - headH * 0.64, 10, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Cute bouncy Ahoge sprout
    ctx.beginPath();
    ctx.moveTo(cx - 4, headY - headH * 0.96);
    ctx.quadraticCurveTo(cx - 14 + hairSway, headY - headH * 1.38, cx + 16 + hairSway * 0.6, headY - headH * 1.22);
    ctx.quadraticCurveTo(cx + 2, headY - headH * 1.12, cx + 4, headY - headH * 0.96);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Front hats that sit over bangs
  if (spec.accessory === 'witch-hat' || spec.accessory === 'gamer-beanie' || spec.accessory === 'royal-crown' || spec.accessory === 'angel-halo') {
    drawTopAccessoryPuppet(ctx, spec, pose, cx, headY - headH, headHalfW);
  }

  drawSideAddonsPuppet(ctx, spec, pose, cx + eyeXShift * 0.4, eyeY, headHalfW + 4, mouthY);
  ctx.restore();
}

function renderAnimalPuppet(ctx: CanvasRenderingContext2D, spec: OpticAvatarSpec, pose: OpticPoseState) {
  drawSoftGroundShadow(ctx, 294, 78);

  const species = spec.characterBase ?? 'neko-cat';
  const fur = spec.bodyColor || '#FFF7ED';
  const darkFur = adjustHex(fur, -48);
  const accent = spec.accentColor || '#FB923C';
  const secondary = spec.secondaryColor || '#FDE68A';
  const outline = adjustHex(fur, -96);

  const hoverY = -pose.hoverY * 95;
  const cx = 160 + pose.headYaw * 12;
  const cy = 164 + pose.headPitch * 8 + hoverY;
  const earWiggle = Math.sin(pose.accessorySpin * 3.4) * 0.08 + pose.mouthOpen * 0.08;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pose.entryScale, pose.entryScale);
  ctx.rotate(pose.headRoll * 0.8);
  ctx.translate(-cx, -cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Tiny shoulders / body
  ctx.fillStyle = darkFur;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 78, 52, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Species Ears / Horns behind head
  if (species === 'lop-bunny') {
    [-1, 1].forEach((dir) => {
      ctx.save();
      ctx.translate(cx + dir * 52, cy - 22);
      ctx.rotate(dir * (0.28 + earWiggle));
      ctx.fillStyle = fur;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(dir * 12, 38, 17, 46, dir * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FDA4AF';
      ctx.beginPath();
      ctx.ellipse(dir * 12, 42, 8, 28, dir * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  } else if (species === 'panda-bear') {
    [-1, 1].forEach((dir) => {
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.arc(cx + dir * 50, cy - 52, 22, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (species === 'cozy-frog') {
    [-1, 1].forEach((dir) => {
      ctx.fillStyle = fur;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx + dir * 36, cy - 44, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  } else if (species === 'baby-dragon') {
    [-1, 1].forEach((dir) => {
      ctx.fillStyle = secondary;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + dir * 24, cy - 48);
      ctx.quadraticCurveTo(cx + dir * 48, cy - 82, cx + dir * 34, cy - 92);
      ctx.quadraticCurveTo(cx + dir * 16, cy - 72, cx + dir * 10, cy - 50);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  } else {
    // Cat / Shiba / Kitsune triangle ears
    const earH = species === 'kitsune-fox' ? 56 : 42;
    [-1, 1].forEach((dir) => {
      ctx.save();
      ctx.translate(cx + dir * 44, cy - 44);
      ctx.rotate(dir * (0.28 + earWiggle));
      ctx.fillStyle = species === 'shiba-inu' ? accent : fur;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-20, 14);
      ctx.lineTo(0, -earH);
      ctx.lineTo(20, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FDA4AF';
      ctx.beginPath();
      ctx.moveTo(-10, 8);
      ctx.lineTo(0, -earH * 0.6);
      ctx.lineTo(10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  // Head Shape
  const stretch = clamp(spec.bodyStretchY ?? 1, 0.85, 1.2);
  ctx.fillStyle = fur;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 70, 58 * stretch, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Species markings
  if (species === 'shiba-inu') {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 22, 62, 34, 0, Math.PI, 0);
    ctx.fill();
    // Cream Shiba eyebrows
    ctx.fillStyle = '#FFFBEB';
    [-22, 22].forEach((dx) => {
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy - 26, 9, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (species === 'panda-bear') {
    ctx.fillStyle = '#18181B';
    [-28, 28].forEach((dx) => {
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy - 4, 18, 15, dx < 0 ? -0.25 : 0.25, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (species === 'kitsune-fox') {
    drawFourPointStar(ctx, cx, cy - 28, 8, accent);
  }

  // Blush
  const blush = clamp(spec.blushIntensity ?? 0.65, 0, 1);
  if (blush > 0.05) {
    ctx.fillStyle = `rgba(251, 113, 133, ${0.48 * blush})`;
    [-42, 42].forEach((dx) => {
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy + 12, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Eyes
  const eyeY = species === 'cozy-frog' ? cy - 40 : cy - 6;
  const eyeGap = (species === 'cozy-frog' ? 36 : 28) * spec.eyeSpacing;
  const fx = cx + pose.headYaw * 12;
  drawAnimeEye(ctx, spec, pose, fx - eyeGap, eyeY, pose.leftEyeScaleY, -1);
  drawAnimeEye(ctx, spec, pose, fx + eyeGap, eyeY, pose.rightEyeScaleY, 1);

  // Whiskers for cat / fox
  if (species === 'neko-cat' || species === 'kitsune-fox') {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.2;
    [-1, 1].forEach((dir) => {
      [-4, 4].forEach((dy) => {
        ctx.beginPath();
        ctx.moveTo(fx + dir * 48, cy + 10 + dy);
        ctx.lineTo(fx + dir * 70, cy + 8 + dy * 1.8);
        ctx.stroke();
      });
    });
  }

  // Cute Nose + Mouth
  if (species !== 'cozy-frog') {
    ctx.fillStyle = '#FB7185';
    ctx.beginPath();
    ctx.moveTo(fx - 5, cy + 6);
    ctx.lineTo(fx + 5, cy + 6);
    ctx.lineTo(fx, cy + 12);
    ctx.closePath();
    ctx.fill();
  }
  drawCharacterMouth(
    ctx,
    { ...spec, mouthStyle: spec.mouthStyle === 'equalizer-bars' ? 'cat-omega' : spec.mouthStyle },
    pose.mouthOpen,
    fx,
    cy + 20,
  );

  // Accessories & Side Addons
  drawTopAccessoryPuppet(ctx, spec, pose, cx, cy - 58, 56);
  drawSideAddonsPuppet(ctx, spec, pose, fx, eyeY, 68, cy + 20);

  // Bongo-Cat Style Reactive Paws
  if ((spec.outfit ?? 'desk-paws') === 'desk-paws' || (spec.outfit ?? 'none') !== 'none') {
    const leftBounce = pose.mouthOpen > 0.08 ? Math.abs(Math.sin(pose.accessorySpin * 18)) * 16 : 0;
    const rightBounce = pose.mouthOpen > 0.08 ? Math.abs(Math.cos(pose.accessorySpin * 18)) * 16 : 0;
    [
      { x: cx - 50, y: 274 - leftBounce },
      { x: cx + 50, y: 274 - rightBounce },
    ].forEach((paw) => {
      ctx.fillStyle = fur;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(paw.x, paw.y, 17, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FDA4AF';
      ctx.beginPath();
      ctx.arc(paw.x, paw.y + 2, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore();
}

function renderComicPuppet(ctx: CanvasRenderingContext2D, spec: OpticAvatarSpec, pose: OpticPoseState) {
  drawSoftGroundShadow(ctx, 294, 70);

  // Subtle hand-drawn animation "line boil"
  const boilPhase = Math.floor(pose.accessorySpin * 8) % 3;
  const boilX = boilPhase === 1 ? 0.8 : boilPhase === 2 ? -0.6 : 0;
  const boilY = boilPhase === 2 ? 0.8 : boilPhase === 0 ? -0.5 : 0;

  const hoverY = -pose.hoverY * 95 + boilY;
  const cx = 160 + pose.headYaw * 12 + boilX;
  const cy = 152 + pose.headPitch * 8 + hoverY;
  const fill = spec.skinColor ?? spec.bodyColor ?? '#FFFFFF';
  const ink = '#0F172A';
  const accent = spec.accentColor || '#38BDF8';
  const variant = spec.characterBase ?? 'marshmallow-toon';

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pose.entryScale, pose.entryScale);
  ctx.rotate(pose.headRoll);
  ctx.translate(-cx, -cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Storytime shoulders
  drawAnimeOutfit(ctx, { ...spec, outfit: spec.outfit === 'none' ? 'oversized-hoodie' : spec.outfit }, cx, cy + 56);

  // Thick Ink Comic Head
  ctx.fillStyle = variant === 'noir-detective' ? '#E2E8F0' : fill;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (variant === 'ink-stickman') {
    ctx.arc(cx, cy, 56, 0, Math.PI * 2);
  } else {
    drawRoundedRectPath(ctx, cx - 58, cy - 58, 116, 114, 44);
  }
  ctx.fill();
  ctx.stroke();

  if (variant === 'noir-detective') {
    // Classic Noir Fedora
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 42, 74, 13, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 44, cy - 44);
    ctx.lineTo(cx - 32, cy - 82);
    ctx.lineTo(cx + 32, cy - 80);
    ctx.lineTo(cx + 44, cy - 44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Expressive Cartoon Eyes
  const fx = cx + pose.headYaw * 12;
  const eyeGap = 24 * spec.eyeSpacing;
  const eyeY = cy - 6 + pose.headPitch * 7;

  [-1, 1].forEach((dir, i) => {
    const sy = i === 0 ? pose.leftEyeScaleY : pose.rightEyeScaleY;
    const ex = fx + dir * eyeGap;
    if (sy < 0.25) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ex - 11, eyeY);
      ctx.lineTo(ex + 11, eyeY);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 13, 17 * sy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(ex + pose.eyeLookX * 4, eyeY + pose.eyeLookY * 3, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating Comic Eyebrows above head/eyes
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    const exp = spec.defaultExpression;
    const by = eyeY - 26 + (exp === 'warning' ? 6 : exp === 'insight' ? -6 : 0);
    const tilt = exp === 'warning' ? dir * -6 : exp === 'skeptical' ? (dir === -1 ? -6 : 4) : 0;
    ctx.beginPath();
    ctx.moveTo(ex - 10, by - tilt);
    ctx.lineTo(ex + 10, by + tilt);
    ctx.stroke();
  });

  drawCharacterMouth(
    ctx,
    { ...spec, mouthStyle: spec.mouthStyle === 'equalizer-bars' ? 'comic-grin' : spec.mouthStyle },
    pose.mouthOpen,
    fx,
    cy + 26,
  );

  // Storytime Coffee Prop when coffee-philosopher
  if (variant === 'coffee-philosopher') {
    ctx.fillStyle = accent;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    drawRoundedRectPath(ctx, cx + 48, cy + 56, 36, 40, 6);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 84, cy + 74, 10, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  }

  drawTopAccessoryPuppet(ctx, spec, pose, cx, cy - 58, 56);
  drawSideAddonsPuppet(ctx, spec, pose, fx, eyeY, 58, cy + 26);
  ctx.restore();
}

function renderPixelPuppet(ctx: CanvasRenderingContext2D, spec: OpticAvatarSpec, pose: OpticPoseState) {
  drawSoftGroundShadow(ctx, 294, 72);

  if (typeof document === 'undefined') return;
  if (!pixelBufferCanvas) {
    pixelBufferCanvas = document.createElement('canvas');
    pixelBufferCanvas.width = 32;
    pixelBufferCanvas.height = 32;
    pixelBufferCtx = pixelBufferCanvas.getContext('2d');
  }
  const p = pixelBufferCtx;
  if (!p || !pixelBufferCanvas) return;

  p.clearRect(0, 0, 32, 32);
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    p.fillStyle = c;
    p.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  const skin = spec.skinColor ?? '#FDE6D8';
  const hair = spec.hairColor ?? spec.bodyColor ?? '#4F46E5';
  const accent = spec.accentColor || '#22D3EE';
  const secondary = spec.secondaryColor || '#FDE047';
  const ink = '#0B1020';
  const base = spec.characterBase ?? 'pixel-mage';
  const blink = pose.blinkScaleY < 0.35;
  const openMouth = pose.mouthOpen > 0.14;

  // Shoulders / Cloak
  px(8, 22, 16, 8, adjustHex(spec.bodyColor || '#1E293B', 10));
  px(7, 23, 1, 7, ink);
  px(24, 23, 1, 7, ink);
  px(9, 21, 14, 2, accent);

  if (base === 'pixel-slime') {
    px(6, 10, 20, 14, accent);
    px(8, 8, 16, 17, accent);
    px(10, 9, 5, 2, '#FFFFFF');
    px(7, 8, 18, 1, ink);
    px(6, 9, 1, 15, ink);
    px(25, 9, 1, 15, ink);
    px(7, 24, 18, 1, ink);
  } else {
    // Head outline + Skin
    px(8, 7, 16, 15, ink);
    px(9, 8, 14, 13, base === 'pixel-neko' ? spec.bodyColor || '#FFF7ED' : skin);

    // Pixel Hair or Mage Hat or Knight Helmet
    if (base === 'pixel-mage') {
      px(5, 8, 22, 2, hair);
      px(8, 4, 16, 4, hair);
      px(11, 1, 10, 3, hair);
      px(9, 7, 14, 1, secondary);
    } else if (base === 'pixel-knight') {
      px(8, 5, 16, 8, '#94A3B8');
      px(14, 2, 4, 3, accent);
      px(10, 10, 12, 3, '#1E293B');
    } else {
      px(8, 5, 16, 5, hair);
      px(8, 9, 3, 5, hair);
      px(21, 9, 3, 5, hair);
      px(11, 6, 4, 1, adjustHex(hair, 45));
      if (base === 'pixel-neko') {
        px(8, 3, 4, 4, hair);
        px(20, 3, 4, 4, hair);
        px(9, 4, 2, 2, '#FDA4AF');
        px(21, 4, 2, 2, '#FDA4AF');
      }
    }

    // Headphones for Lo-Fi or Cyber
    if (base === 'pixel-lofi' || spec.sideAddon === 'studio-headphones') {
      px(6, 10, 3, 7, accent);
      px(23, 10, 3, 7, accent);
      px(8, 4, 16, 2, '#334155');
    }
  }

  // Pixel Eyes
  const eyeColor = base === 'pixel-cyber' ? accent : ink;
  if (blink) {
    px(11, 14, 3, 1, eyeColor);
    px(18, 14, 3, 1, eyeColor);
  } else if (base === 'pixel-cyber') {
    px(10, 12, 12, 4, ink);
    px(11, 13, 4, 2, accent);
    px(17, 13, 4, 2, accent);
  } else {
    px(11, 12, 3, 4, eyeColor);
    px(18, 12, 3, 4, eyeColor);
    px(11, 12, 1, 1, '#FFFFFF');
    px(18, 12, 1, 1, '#FFFFFF');
  }

  // Pixel Blush & Mouth
  px(10, 16, 2, 1, '#FDA4AF');
  px(20, 16, 2, 1, '#FDA4AF');
  if (openMouth) {
    px(14, 18, 4, 3, '#881337');
    px(15, 19, 2, 2, '#FB7185');
  } else {
    px(14, 18, 4, 1, '#4C1D95');
  }

  // Blit crisp pixel art with integer nearest-neighbor scaling
  const hoverY = -pose.hoverY * 90;
  const cx = 160 + pose.headYaw * 10;
  const cy = 152 + pose.headPitch * 8 + hoverY;
  const drawSize = 248 * pose.entryScale;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(pose.headRoll * 0.6);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixelBufferCanvas, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
  ctx.imageSmoothingEnabled = true;

  // Pixel sparkles around avatar
  if (Math.sin(pose.accessorySpin * 4) > 0) {
    ctx.fillStyle = secondary;
    ctx.fillRect(cx - 108, cy - 68, 8, 8);
    ctx.fillStyle = accent;
    ctx.fillRect(cx + 98, cy - 42, 8, 8);
  }
  ctx.restore();
}

function renderCustomSpritePuppet(ctx: CanvasRenderingContext2D, spec: OpticAvatarSpec, pose: OpticPoseState) {
  drawSoftGroundShadow(ctx, 294, 76);
  const sprites = spec.customSprites;
  if (!sprites?.idleUrl) {
    renderAnimePuppet(ctx, { ...spec, universe: 'anime' }, pose);
    return;
  }

  const isTalking = pose.mouthOpen > 0.12;
  const isBlinking = pose.blinkScaleY < 0.42;

  let chosenUrl = sprites.idleUrl;
  let usedDistinctTalk = false;
  if (isTalking && isBlinking && sprites.talkBlinkUrl) {
    chosenUrl = sprites.talkBlinkUrl;
    usedDistinctTalk = true;
  } else if (isTalking && sprites.talkUrl) {
    chosenUrl = sprites.talkUrl;
    usedDistinctTalk = true;
  } else if (isBlinking && sprites.blinkUrl) {
    chosenUrl = sprites.blinkUrl;
  }

  const entry = getOrLoadSprite(chosenUrl) ?? getOrLoadSprite(sprites.idleUrl);
  if (!entry || !entry.ready || entry.error) {
    renderAnimePuppet(ctx, { ...spec, universe: 'anime' }, pose);
    return;
  }

  const hoverY = -pose.hoverY * 85 - (isTalking ? pose.mouthOpen * 6 : 0);
  const scaleY = usedDistinctTalk
    ? 1 + pose.mouthOpen * 0.015
    : 1 + pose.mouthOpen * 0.055;
  const scaleX = usedDistinctTalk
    ? 1
    : 1 - pose.mouthOpen * 0.028;

  const boxSize = 264 * pose.entryScale;
  const aspect = entry.img.naturalWidth > 0 && entry.img.naturalHeight > 0
    ? entry.img.naturalWidth / entry.img.naturalHeight
    : 1;
  const drawW = aspect >= 1 ? boxSize : boxSize * aspect;
  const drawH = aspect >= 1 ? boxSize / aspect : boxSize;

  ctx.save();
  ctx.translate(160 + pose.headYaw * 8, 158 + pose.headPitch * 6 + hoverY);
  ctx.rotate(pose.headRoll * 0.45);
  ctx.scale(scaleX, scaleY);

  if (isTalking) {
    ctx.shadowColor = hexToRgba(spec.accentColor || '#38BDF8', 0.45);
    ctx.shadowBlur = 14 + pose.mouthOpen * 12;
  }
  ctx.drawImage(entry.img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.shadowBlur = 0;

  // Expressive mini voice bars near corner when talking on single-image uploads
  if (!usedDistinctTalk && isTalking) {
    ctx.fillStyle = spec.accentColor || '#38BDF8';
    for (let i = 0; i < 3; i++) {
      const h = 6 + pose.mouthOpen * (14 - i * 3);
      drawRoundedRectPath(ctx, drawW / 2 - 22 + i * 7, -drawH / 2 + 18 - h / 2, 4, h, 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function renderTechHardware25D(ctx: CanvasRenderingContext2D, spec: OpticAvatarSpec, pose: OpticPoseState) {
  drawSoftGroundShadow(ctx, 278, 72);

  const hoverOffset = -pose.hoverY * 110;
  ctx.save();
  ctx.translate(160, 160 + hoverOffset);
  ctx.scale(pose.entryScale, pose.entryScale);
  ctx.rotate(pose.headRoll);
  ctx.translate(-160, -160);

  const isOrbital = spec.chassis === 'orbital-core';
  const isPod = spec.chassis === 'braun-pod';
  const isPill = spec.chassis === 'capsule-pill';
  const isDrone = spec.chassis === 'drone-shell';
  const isCrt = spec.chassis === 'crt-monitor';
  const isCube = spec.chassis === 'tactile-cube';
  const stretch = clamp(spec.bodyStretchY ?? 1, 0.8, 1.25);

  const bodyW = isOrbital ? 174 : isPill ? 206 : isDrone ? 196 : isCrt ? 188 : isPod ? 182 : isCube ? 168 : 160;
  const bodyH = Math.round(
    (isOrbital ? 174 : isPill ? 138 : isDrone ? 136 : isCrt ? 162 : isPod ? 156 : isCube ? 168 : 188) * stretch,
  );
  const bodyX = 160 - bodyW / 2 + pose.headYaw * 12;
  const bodyY = 156 - bodyH / 2 + pose.headPitch * 9;
  const bodyRadius = isOrbital || isPill || isDrone ? bodyH / 2 : isPod ? 34 + spec.roundness * 34 : 16 + spec.roundness * 26;

  drawTopAccessoryPuppet(ctx, spec, pose, 160 + pose.headYaw * 12, bodyY, bodyW / 2);

  ctx.fillStyle = spec.bodyColor;
  ctx.strokeStyle = spec.accentColor;
  ctx.lineWidth = 2.5;
  drawRoundedRectPath(ctx, bodyX, bodyY, bodyW, bodyH, bodyRadius);
  ctx.fill();
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const visorW = 132 * spec.visorScale;
  const visorH = 82 * spec.visorScale;
  const visorX = 160 - visorW / 2 + pose.headYaw * 24;
  const visorY = 148 - visorH / 2 + pose.headPitch * 17;
  ctx.fillStyle = spec.visorColor;
  drawRoundedRectPath(ctx, visorX, visorY, visorW, visorH, 12 + spec.roundness * 16);
  ctx.fill();
  ctx.strokeStyle = spec.accentColor;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const eyeXCenter = 160 + pose.headYaw * 32 + pose.eyeLookX * 8;
  const eyeYCenter = 144 + pose.headPitch * 22 + pose.eyeLookY * 6;
  const eyeGap = 25 * spec.eyeSpacing;
  const leftH = Math.max(3, 28 * pose.leftEyeScaleY);
  const rightH = Math.max(3, 28 * pose.rightEyeScaleY);

  ctx.fillStyle = spec.accentColor;
  if (spec.eyeStyle === 'aperture-iris' || spec.eyeStyle === 'cyclops-orb' || spec.eyeStyle === 'crosshair-hud') {
    const r = Math.max(12, Math.min(24, (20 * Math.min(leftH, rightH)) / 28 + 4));
    ctx.beginPath();
    ctx.arc(eyeXCenter, eyeYCenter, r, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = spec.accentColor;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(eyeXCenter, eyeYCenter, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (spec.eyeStyle === 'happy-arcs') {
    ctx.strokeStyle = spec.accentColor;
    ctx.lineWidth = 5;
    [-eyeGap, eyeGap].forEach((dx) => {
      ctx.beginPath();
      ctx.arc(eyeXCenter + dx, eyeYCenter + 4, 14, Math.PI, 0);
      ctx.stroke();
    });
  } else {
    const r = spec.eyeStyle === 'pixel-matrix' ? 3 : 6;
    drawRoundedRectPath(ctx, eyeXCenter - eyeGap - 9, eyeYCenter - leftH / 2, 18, leftH, r);
    ctx.fill();
    drawRoundedRectPath(ctx, eyeXCenter + eyeGap - 9, eyeYCenter - rightH / 2, 18, rightH, r);
    ctx.fill();
  }

  const mouthStyle = spec.mouthStyle ?? 'equalizer-bars';
  const mouthY = visorY + visorH - 13;
  ctx.fillStyle = spec.secondaryColor;
  if (mouthStyle !== 'none') {
    if (pose.mouthOpen > 0.02) {
      [0.42, 0.8, 1.0, 0.78, 0.44].forEach((w, idx) => {
        const h = Math.max(4, 3 + pose.mouthOpen * w * 18);
        drawRoundedRectPath(ctx, eyeXCenter - 26 + idx * 12, mouthY - h / 2, 6, h, 3);
        ctx.fill();
      });
    } else {
      ctx.globalAlpha = 0.45;
      drawRoundedRectPath(ctx, eyeXCenter - 20, mouthY - 1.5, 40, 3, 1.5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawSideAddonsPuppet(ctx, spec, pose, 160 + pose.headYaw * 12, eyeYCenter, bodyW / 2, mouthY);
  ctx.restore();
}

export function renderPuppet25DFrame(
  ctx: CanvasRenderingContext2D,
  spec: OpticAvatarSpec,
  pose: OpticPoseState,
  size: number,
): void {
  const scale = size / 320;
  ctx.save();
  ctx.scale(scale, scale);

  const universe: OpticUniverseId =
    spec.customSprites?.idleUrl
      ? 'custom-art'
      : spec.universe ?? 'tech';

  switch (universe) {
    case 'custom-art':
      renderCustomSpritePuppet(ctx, spec, pose);
      break;
    case 'anime':
      renderAnimePuppet(ctx, spec, pose);
      break;
    case 'animal':
      renderAnimalPuppet(ctx, spec, pose);
      break;
    case 'comic':
      renderComicPuppet(ctx, spec, pose);
      break;
    case 'pixel':
      renderPixelPuppet(ctx, spec, pose);
      break;
    case 'tech':
    default:
      renderTechHardware25D(ctx, spec, pose);
      break;
  }

  ctx.restore();
}
