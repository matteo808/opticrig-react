export type OpticRenderEngine = '3d' | '2.5d';

export type OpticUniverseId =
  | 'anime'
  | 'animal'
  | 'comic'
  | 'pixel'
  | 'tech'
  | 'custom-art';

export type OpticCharacterBaseId =
  | 'anime-shonen'
  | 'anime-shojo'
  | 'chibi-idol'
  | 'cyber-ninja'
  | 'goth-witch'
  | 'academy-senpai'
  | 'neko-cat'
  | 'shiba-inu'
  | 'kitsune-fox'
  | 'cozy-frog'
  | 'lop-bunny'
  | 'baby-dragon'
  | 'panda-bear'
  | 'marshmallow-toon'
  | 'ink-stickman'
  | 'noir-detective'
  | 'cozy-hoodie-kid'
  | 'coffee-philosopher'
  | 'pixel-mage'
  | 'pixel-cyber'
  | 'pixel-neko'
  | 'pixel-knight'
  | 'pixel-slime'
  | 'pixel-lofi'
  | 'tech-core';

export type OpticHairStyleId =
  | 'messy-layers'
  | 'twin-tails'
  | 'hime-bob'
  | 'spiky-shonen'
  | 'long-flowing'
  | 'wolf-cut'
  | 'cozy-bun'
  | 'none';

export type OpticOutfitId =
  | 'oversized-hoodie'
  | 'cyber-jacket'
  | 'academy-blazer'
  | 'cozy-sweater'
  | 'fantasy-cloak'
  | 'streetwear-tee'
  | 'desk-paws'
  | 'none';

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
  | 'crosshair-hud'
  | 'anime-sparkle'
  | 'anime-cat'
  | 'kawaii-dots'
  | 'comic-expressive'
  | 'starry-idol';

export type OpticMouthStyle =
  | 'equalizer-bars'
  | 'oscilloscope-line'
  | 'speaker-dots'
  | 'pulse-core'
  | 'anime-fang'
  | 'cat-omega'
  | 'gentle-smile'
  | 'comic-grin'
  | 'none';

export type OpticAccessoryId =
  | 'antenna-pin'
  | 'twin-antennas'
  | 'halo-ring'
  | 'visor-hood'
  | 'floating-pointer'
  | 'cat-ears'
  | 'neko-ears'
  | 'fox-ears'
  | 'demon-horns'
  | 'angel-halo'
  | 'witch-hat'
  | 'gamer-beanie'
  | 'frog-leaf'
  | 'royal-crown'
  | 'none';

export type OpticSideAddonId =
  | 'studio-headphones'
  | 'side-fins'
  | 'rotary-knobs'
  | 'round-glasses'
  | 'cyber-visor-shades'
  | 'floating-sparkles'
  | 'mic-boom'
  | 'none';

export type OpticMaterialFinish =
  | 'matte-ceramic'
  | 'anodized-alloy'
  | 'obsidian-glass'
  | 'warm-bakelite';

export type OpticExpression = 'idle' | 'talking' | 'skeptical' | 'insight' | 'warning' | 'approve';
export type OpticCameraPreset = 'front' | 'three-quarter' | 'side';

export interface OpticCustomSprites {
  idleUrl: string;
  talkUrl?: string | null;
  blinkUrl?: string | null;
  talkBlinkUrl?: string | null;
}

export interface OpticAvatarSpec {
  renderEngine: OpticRenderEngine;
  universe?: OpticUniverseId;
  characterBase?: OpticCharacterBaseId;
  hairStyle?: OpticHairStyleId;
  hairColor?: string;
  skinColor?: string;
  outfit?: OpticOutfitId;
  blushIntensity?: number;
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
  customVrmUrl?: string | null;
  customSprites?: OpticCustomSprites | null;
}

export interface OpticWordTimestamp {
  word: string;
  startSec: number;
  endSec: number;
  speaker?: string;
}
