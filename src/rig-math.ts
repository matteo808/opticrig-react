import type {
  OpticAvatarSpec,
  OpticExpression,
  OpticRenderEngine,
  OpticUniverseId,
  OpticWordTimestamp,
} from './types.ts';

export function inferDefaultRenderEngine(universe: OpticUniverseId): OpticRenderEngine {
  return universe === 'animal' || universe === 'tech' ? '3d' : '2.5d';
}

export const FALLBACK_OPTIC_SPEC: OpticAvatarSpec = {
  renderEngine: '3d',
  universe: 'tech',
  characterBase: 'tech-core',
  hairStyle: 'none',
  hairColor: '#1E293B',
  skinColor: '#FFE4D6',
  outfit: 'none',
  blushIntensity: 0.45,
  chassis: 'orbital-core',
  eyeStyle: 'aperture-iris',
  mouthStyle: 'equalizer-bars',
  accessory: 'halo-ring',
  sideAddon: 'none',
  materialFinish: 'obsidian-glass',
  bodyColor: '#0F172A',
  visorColor: '#050814',
  accentColor: '#38BDF8',
  secondaryColor: '#FDE68A',
  roundness: 0.45,
  visorScale: 1,
  eyeSpacing: 1,
  hoverAmplitude: 1,
  glowIntensity: 1,
  bodyStretchY: 1,
  defaultExpression: 'idle',
  roleBadge: 'AI CO-PILOT',
  customGlbUrl: null,
  customVrmUrl: null,
  customSprites: null,
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function parseOpticSpecSafe(
  raw: string | Partial<OpticAvatarSpec> | null | undefined,
): OpticAvatarSpec {
  let partial: Partial<OpticAvatarSpec> = {};
  if (typeof raw === 'string' && raw.trim()) {
    try {
      partial = JSON.parse(raw) as Partial<OpticAvatarSpec>;
    } catch {
      partial = {};
    }
  } else if (raw && typeof raw === 'object') {
    partial = raw;
  }

  const universe: OpticUniverseId = partial.universe ?? FALLBACK_OPTIC_SPEC.universe ?? 'tech';

  return {
    ...FALLBACK_OPTIC_SPEC,
    ...partial,
    universe,
    characterBase: partial.characterBase ?? FALLBACK_OPTIC_SPEC.characterBase,
    hairStyle: partial.hairStyle ?? FALLBACK_OPTIC_SPEC.hairStyle,
    hairColor: partial.hairColor ?? FALLBACK_OPTIC_SPEC.hairColor,
    skinColor: partial.skinColor ?? FALLBACK_OPTIC_SPEC.skinColor,
    outfit: partial.outfit ?? FALLBACK_OPTIC_SPEC.outfit,
    blushIntensity: clamp(
      typeof partial.blushIntensity === 'number'
        ? partial.blushIntensity
        : (FALLBACK_OPTIC_SPEC.blushIntensity ?? 0.45),
      0,
      1,
    ),
    mouthStyle: partial.mouthStyle ?? FALLBACK_OPTIC_SPEC.mouthStyle,
    sideAddon: partial.sideAddon ?? FALLBACK_OPTIC_SPEC.sideAddon,
    roundness: clamp(
      typeof partial.roundness === 'number' ? partial.roundness : FALLBACK_OPTIC_SPEC.roundness,
      0,
      1,
    ),
    visorScale: clamp(
      typeof partial.visorScale === 'number' ? partial.visorScale : FALLBACK_OPTIC_SPEC.visorScale,
      0.75,
      1.25,
    ),
    eyeSpacing: clamp(
      typeof partial.eyeSpacing === 'number' ? partial.eyeSpacing : FALLBACK_OPTIC_SPEC.eyeSpacing,
      0.75,
      1.3,
    ),
    hoverAmplitude: clamp(
      typeof partial.hoverAmplitude === 'number'
        ? partial.hoverAmplitude
        : FALLBACK_OPTIC_SPEC.hoverAmplitude,
      0,
      1.8,
    ),
    glowIntensity: clamp(
      typeof partial.glowIntensity === 'number'
        ? partial.glowIntensity
        : (FALLBACK_OPTIC_SPEC.glowIntensity ?? 1),
      0.3,
      2,
    ),
    bodyStretchY: clamp(
      typeof partial.bodyStretchY === 'number'
        ? partial.bodyStretchY
        : (FALLBACK_OPTIC_SPEC.bodyStretchY ?? 1),
      0.8,
      1.25,
    ),
    customVrmUrl: partial.customVrmUrl ?? null,
    customSprites: partial.customSprites ?? null,
  };
}

export function slugifyOpticName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || `opticrig-${Date.now().toString(36)}`;
}

export interface OpticPoseState {
  hoverY: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  blinkScaleY: number;
  leftEyeScaleY: number;
  rightEyeScaleY: number;
  eyeLookX: number;
  eyeLookY: number;
  mouthOpen: number;
  visorGlow: number;
  accessorySpin: number;
  entryScale: number;
}

export interface ComputeOpticPoseParams {
  timeSec: number;
  expression: OpticExpression;
  talkLevel: number;
  entryProgress?: number;
  orbitYawRad?: number;
  orbitPitchRad?: number;
  hoverAmplitude?: number;
}

export function computeTalkLevelAtTime(
  wordTimestamps: OpticWordTimestamp[] | undefined,
  timeSec: number,
  speakerFilter = 'any',
): number {
  if (!wordTimestamps || wordTimestamps.length === 0) return 0;

  for (let i = 0; i < wordTimestamps.length; i++) {
    const w = wordTimestamps[i]!;
    if (speakerFilter !== 'any' && w.speaker !== speakerFilter) {
      continue;
    }
    if (timeSec >= w.startSec - 0.03 && timeSec <= w.endSec + 0.05) {
      const dur = Math.max(0.08, w.endSec - w.startSec);
      const u = clamp((timeSec - w.startSec) / dur, 0, 1);
      const envelope = Math.sin(u * Math.PI);
      const syllable = 0.4 + 0.6 * Math.abs(Math.sin(timeSec * Math.PI * 11));
      return clamp(0.25 + 0.75 * envelope * syllable, 0, 1);
    }
  }
  return 0;
}

export function computeOpticPoseState(params: ComputeOpticPoseParams): OpticPoseState {
  const t = Math.max(0, params.timeSec);
  const talk = clamp(params.talkLevel, 0, 1);
  const hoverAmp = clamp(params.hoverAmplitude ?? 1, 0, 2);
  const entry = clamp(params.entryProgress ?? 1, 0, 1);

  const blinkCycle = t % 3.4;
  let blinkScaleY = 1;
  if (blinkCycle > 3.16 && blinkCycle < 3.34) {
    const phase = (blinkCycle - 3.16) / 0.18;
    blinkScaleY = 0.08 + 0.92 * Math.abs(phase * 2 - 1);
  }

  let hoverY = Math.sin(t * 2.1) * 0.065 * hoverAmp;
  let headYaw = Math.sin(t * 0.95) * 0.09 + (params.orbitYawRad ?? 0);
  let headPitch = Math.sin(t * 1.35 + 0.8) * 0.045 + (params.orbitPitchRad ?? 0);
  let headRoll = Math.sin(t * 0.72) * 0.03;

  let eyeLookX = Math.sin(t * 0.85) * 0.18;
  let eyeLookY = Math.cos(t * 1.15) * 0.08;
  let leftEyeScaleY = blinkScaleY;
  let rightEyeScaleY = blinkScaleY;
  let visorGlow = 0.85 + Math.sin(t * 2.8) * 0.12;

  switch (params.expression) {
    case 'skeptical':
      headRoll += 0.14;
      headYaw -= 0.14;
      leftEyeScaleY *= 0.56;
      rightEyeScaleY *= 1.06;
      eyeLookX += 0.28;
      eyeLookY -= 0.06;
      break;
    case 'insight':
      headPitch -= 0.09;
      hoverY += 0.025 * hoverAmp;
      leftEyeScaleY = clamp(leftEyeScaleY * 1.18, 0.08, 1.25);
      rightEyeScaleY = clamp(rightEyeScaleY * 1.18, 0.08, 1.25);
      visorGlow += 0.55;
      break;
    case 'warning':
      headRoll += Math.sin(t * 14) * 0.045;
      leftEyeScaleY *= 0.72;
      rightEyeScaleY *= 0.72;
      visorGlow += 0.65 + Math.sin(t * 9) * 0.22;
      break;
    case 'approve':
      headPitch += Math.sin(t * 6.4) * 0.12;
      headYaw *= 0.5;
      visorGlow += 0.35;
      break;
    case 'talking':
      headPitch += Math.sin(t * 5.2) * 0.045 * Math.max(0.4, talk);
      headYaw += Math.sin(t * 2.6) * 0.05;
      visorGlow += 0.25 * talk;
      break;
    case 'idle':
    default:
      break;
  }

  if (talk > 0.02) {
    headPitch += Math.sin(t * 6.2) * 0.035 * talk;
    visorGlow += 0.45 * talk;
  }

  const mouthOpen =
    talk > 0.01
      ? clamp(talk * (0.65 + 0.35 * Math.abs(Math.sin(t * 16))), 0.05, 1)
      : params.expression === 'talking'
        ? 0.28 + 0.22 * Math.abs(Math.sin(t * 10))
        : 0;

  return {
    hoverY,
    headYaw,
    headPitch,
    headRoll,
    blinkScaleY,
    leftEyeScaleY,
    rightEyeScaleY,
    eyeLookX: clamp(eyeLookX, -1, 1),
    eyeLookY: clamp(eyeLookY, -1, 1),
    mouthOpen,
    visorGlow,
    accessorySpin: t * 0.85,
    entryScale: 0.72 + 0.28 * entry,
  };
}
