export type OpticRenderEngine = '3d' | '2.5d';
export type OpticChassisId =
  | 'braun-pod'
  | 'swiss-monolith'
  | 'cyber-prism'
  | 'orbital-core'
  | 'crt-monitor'
  | 'capsule-pill'
  | 'tactile-cube'
  | 'drone-shell';

export type OpticEyeStyle =
  | 'twin-optics'
  | 'aperture-iris'
  | 'waveform-visor'
  | 'minimal-slit'
  | 'happy-arcs'
  | 'pixel-matrix'
  | 'cyclops-orb'
  | 'crosshair-hud';

export type OpticMouthStyle =
  | 'equalizer-bars'
  | 'oscilloscope-line'
  | 'speaker-dots'
  | 'pulse-core'
  | 'none';

export type OpticAccessoryId =
  | 'antenna-pin'
  | 'twin-antennas'
  | 'halo-ring'
  | 'visor-hood'
  | 'floating-pointer'
  | 'cat-ears'
  | 'none';

export type OpticSideAddonId =
  | 'studio-headphones'
  | 'side-fins'
  | 'rotary-knobs'
  | 'none';

export type OpticMaterialFinish =
  | 'matte-ceramic'
  | 'anodized-alloy'
  | 'obsidian-glass'
  | 'warm-bakelite';

export type OpticExpression = 'idle' | 'talking' | 'skeptical' | 'insight' | 'warning' | 'approve';
export type OpticCameraPreset = 'front' | 'three-quarter' | 'side';

export interface OpticAvatarSpec {
  renderEngine: OpticRenderEngine;
  chassis: OpticChassisId;
  eyeStyle: OpticEyeStyle;
  mouthStyle?: OpticMouthStyle;
  accessory: OpticAccessoryId;
  sideAddon?: OpticSideAddonId;
  materialFinish: OpticMaterialFinish;
  bodyColor: string;
  visorColor: string;
  accentColor: string;
  secondaryColor: string;
  roundness: number;
  visorScale: number;
  eyeSpacing: number;
  hoverAmplitude: number;
  glowIntensity?: number;
  bodyStretchY?: number;
  defaultExpression: OpticExpression;
  roleBadge: string;
  customGlbUrl?: string | null;
}

export interface OpticWordTimestamp {
  word: string;
  startSec: number;
  endSec: number;
  speaker?: string;
}
