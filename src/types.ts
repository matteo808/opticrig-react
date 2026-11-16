export type OpticRenderEngine = '3d' | '2.5d';
export type OpticChassisId = 'braun-pod' | 'swiss-monolith' | 'cyber-prism' | 'orbital-core';
export type OpticEyeStyle = 'twin-optics' | 'aperture-iris' | 'waveform-visor' | 'minimal-slit';
export type OpticAccessoryId = 'antenna-pin' | 'halo-ring' | 'visor-hood' | 'floating-pointer' | 'none';
export type OpticMaterialFinish = 'matte-ceramic' | 'anodized-alloy' | 'obsidian-glass' | 'warm-bakelite';
export type OpticExpression = 'idle' | 'talking' | 'skeptical' | 'insight' | 'warning' | 'approve';
export type OpticCameraPreset = 'front' | 'three-quarter' | 'side';

export interface OpticAvatarSpec {
  renderEngine: OpticRenderEngine;
  chassis: OpticChassisId;
  eyeStyle: OpticEyeStyle;
  accessory: OpticAccessoryId;
  materialFinish: OpticMaterialFinish;
  bodyColor: string;
  visorColor: string;
  accentColor: string;
  secondaryColor: string;
  roundness: number;
  visorScale: number;
  eyeSpacing: number;
  hoverAmplitude: number;
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
