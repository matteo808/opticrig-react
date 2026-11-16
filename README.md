# `@opticrig/react` — Open-Core Avatar Runtime (MIT)

Deterministic **Dual-Engine (Three.js 3D + Layered 2.5D SVG)** robot/optic mascot runtime designed for:
- **AI Voice Agents** (Gemini Live, OpenAI Realtime, ElevenLabs, WebAudio `AnalyserNode`)
- **Programmatic Remotion Videos** (`deterministicTimeSec` prop driven by `useCurrentFrame() / fps`)
- **React SaaS Co-Pilots & Onboarding Bubbles**

> **Need the Visual 3D Sculptor, 6 Niche Archetypes, Custom `.glb` Exporter & 60fps Transparent `.webm` Video Clipper for CapCut / Premiere?**  
> Launch the full cloud studio at **[opticrig.studio](https://opticrig.studio)** (Free tier + `$59` Founder Launch Pack).

## Quick Usage

```tsx
import { OpticAvatar, FALLBACK_OPTIC_SPEC } from '@opticrig/react';

export function VoiceAgentMascot({ audioLevel }: { audioLevel: number }) {
  return (
    <OpticAvatar
      spec={{ ...FALLBACK_OPTIC_SPEC, accentColor: '#22D3EE' }}
      expression={audioLevel > 0.1 ? 'talking' : 'idle'}
      talkLevel={audioLevel}
      size={220}
    />
  );
}
```
