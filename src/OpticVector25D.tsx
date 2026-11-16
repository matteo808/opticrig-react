import React, { useId } from 'react';
import { computeOpticPoseState, type OpticPoseState } from './rig-math.ts';
import type { OpticAvatarSpec, OpticExpression } from './types.ts';

export interface OpticVector25DProps {
  spec: OpticAvatarSpec;
  pose?: OpticPoseState;
  expression?: OpticExpression;
  timeSec?: number;
  talkLevel?: number;
  size?: number;
  className?: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function adjustHex(hex: string, delta: number): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const r = clamp(Number.parseInt(clean.slice(0, 2), 16) + delta, 0, 255);
  const g = clamp(Number.parseInt(clean.slice(2, 4), 16) + delta, 0, 255);
  const b = clamp(Number.parseInt(clean.slice(4, 6), 16) + delta, 0, 255);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function buildPrismPolygon(x: number, y: number, w: number, h: number, cut: number): string {
  const x2 = x + w;
  const y2 = y + h;
  return [
    `${x + cut},${y}`,
    `${x2 - cut},${y}`,
    `${x2},${y + cut}`,
    `${x2},${y2 - cut}`,
    `${x2 - cut},${y2}`,
    `${x + cut},${y2}`,
    `${x},${y2 - cut}`,
    `${x},${y + cut}`,
  ].join(' ');
}

function computeSvgModel(spec: OpticAvatarSpec, pose: OpticPoseState) {
  const yaw = clamp(pose.headYaw, -0.7, 0.7);
  const pitch = clamp(pose.headPitch, -0.5, 0.5);
  const pxBack = -yaw * 14;
  const pyBack = -pitch * 10;
  const pxBody = yaw * 12;
  const pyBody = pitch * 9;
  const pxVisor = yaw * 24;
  const pyVisor = pitch * 17;
  const pxEye = yaw * 32 + pose.eyeLookX * 8;
  const pyEye = pitch * 22 + pose.eyeLookY * 6;
  const tiltDeg = (pose.headRoll * 180) / Math.PI;
  const hoverOffsetPx = -pose.hoverY * 110;

  const isOrbital = spec.chassis === 'orbital-core';
  const isPod = spec.chassis === 'braun-pod';
  const isPrism = spec.chassis === 'cyber-prism';

  const bodyW = isOrbital ? 174 : isPod ? 182 : isPrism ? 168 : 158;
  const bodyH = isOrbital ? 174 : isPod ? 156 : isPrism ? 176 : 190;
  const bodyX = 160 - bodyW / 2;
  const bodyY = 156 - bodyH / 2;
  const bodyRadius = isOrbital
    ? 87
    : isPod
      ? 34 + spec.roundness * 34
      : isPrism
        ? 14 + spec.roundness * 14
        : 10 + spec.roundness * 26;

  const visorW = (isOrbital ? 124 : 132) * clamp(spec.visorScale, 0.75, 1.25);
  const visorH = (isOrbital ? 78 : 82) * clamp(spec.visorScale, 0.75, 1.25);
  const visorX = 160 - visorW / 2;
  const visorY = 148 - visorH / 2;
  const visorRadius = isOrbital ? visorH / 2 : 12 + spec.roundness * 18;

  const isLightBody =
    spec.materialFinish === 'matte-ceramic' && spec.bodyColor.toUpperCase() > '#888888';
  const bodyHighlight = adjustHex(spec.bodyColor, isLightBody ? 16 : 26);
  const bodyShadow = adjustHex(spec.bodyColor, -26);
  const glossOpacity =
    spec.materialFinish === 'obsidian-glass'
      ? 0.34
      : spec.materialFinish === 'anodized-alloy'
        ? 0.22
        : spec.materialFinish === 'warm-bakelite'
          ? 0.16
          : 0.08;

  const eyeGap = 25 * clamp(spec.eyeSpacing, 0.75, 1.3);
  const leftH = clamp(28 * pose.leftEyeScaleY, 3, 36);
  const rightH = clamp(28 * pose.rightEyeScaleY, 3, 36);

  const waveBase = pose.mouthOpen;
  const waveHeights = [0.42, 0.8, 1.0, 0.78, 0.44].map((w, idx) =>
    Math.max(
      3,
      Math.round(3 + waveBase * w * 18 * (0.85 + 0.15 * Math.sin(pose.accessorySpin * 5 + idx))),
    ),
  );

  const shadowScale = clamp(1 - pose.hoverY * 1.4, 0.8, 1.15);

  return {
    pxBack,
    pyBack,
    pxBody,
    pyBody,
    pxVisor,
    pyVisor,
    pxEye,
    pyEye,
    tiltDeg,
    hoverOffsetPx,
    entryScale: pose.entryScale,
    bodyW,
    bodyH,
    bodyX,
    bodyY,
    bodyRadius,
    visorW,
    visorH,
    visorX,
    visorY,
    visorRadius,
    bodyHighlight,
    bodyShadow,
    glossOpacity,
    eyeGap,
    leftH,
    rightH,
    waveHeights,
    shadowScale,
  };
}

function buildCoreSvgInner(spec: OpticAvatarSpec, pose: OpticPoseState, uid: string) {
  const m = computeSvgModel(spec, pose);
  const gradBodyId = `${uid}_body`;
  const gradVisorId = `${uid}_visor`;
  const glowId = `${uid}_glow`;

  const prismPoints = buildPrismPolygon(m.bodyX, m.bodyY, m.bodyW, m.bodyH, 26);
  const prismRimPoints = buildPrismPolygon(
    m.bodyX + 5,
    m.bodyY + 5,
    m.bodyW - 10,
    m.bodyH - 10,
    23,
  );

  const cx = 160;
  const eyeCenterY = 144;
  const mouthY = m.visorY + m.visorH - 13;

  const haloRotDeg = Math.sin(pose.accessorySpin) * 8 - 14;
  const pointerBobY = Math.sin(pose.accessorySpin * 2.2) * 7;

  const chassisSvgStr =
    spec.chassis === 'cyber-prism'
      ? `<polygon points="${prismPoints}" fill="url(#${gradBodyId})" stroke="${m.bodyHighlight}" stroke-width="2.5" />
         <polygon points="${prismRimPoints}" fill="none" stroke="${spec.accentColor}" stroke-opacity="0.32" stroke-width="1.2" />`
      : `<rect x="${m.bodyX}" y="${m.bodyY}" width="${m.bodyW}" height="${m.bodyH}" rx="${m.bodyRadius}" fill="url(#${gradBodyId})" stroke="${m.bodyHighlight}" stroke-width="2.5" />`;

  const accessoryBackStr =
    spec.accessory === 'halo-ring'
      ? `<g transform="translate(${cx + m.pxBack} ${150 + m.pyBack}) rotate(${haloRotDeg.toFixed(2)})">
           <ellipse cx="0" cy="0" rx="124" ry="42" fill="none" stroke="${spec.accentColor}" stroke-width="4" stroke-opacity="0.72" />
           <circle cx="124" cy="0" r="6" fill="${spec.secondaryColor}" />
         </g>`
      : spec.accessory === 'antenna-pin'
        ? `<g transform="translate(${m.pxBody} ${m.pyBody})">
             <line x1="${cx + 38}" y1="${m.bodyY + 6}" x2="${cx + 46}" y2="${m.bodyY - 34}" stroke="${spec.secondaryColor}" stroke-width="4" stroke-linecap="round" />
             <circle cx="${cx + 46}" cy="${m.bodyY - 38}" r="7" fill="${spec.accentColor}" />
           </g>`
        : '';

  const accessoryFrontStr =
    spec.accessory === 'visor-hood'
      ? `<path d="M ${m.visorX - 8} ${m.visorY + 14} Q ${cx} ${m.visorY - 18} ${m.visorX + m.visorW + 8} ${m.visorY + 14} L ${m.visorX + m.visorW + 2} ${m.visorY + 2} Q ${cx} ${m.visorY - 26} ${m.visorX - 2} ${m.visorY + 2} Z" fill="${m.bodyHighlight}" stroke="${spec.accentColor}" stroke-opacity="0.45" stroke-width="1.5" />`
      : spec.accessory === 'floating-pointer'
        ? `<g transform="translate(${cx + m.bodyW / 2 + 26 + m.pxVisor * 0.4} ${(164 + pointerBobY).toFixed(1)})">
             <polygon points="0,-14 22,0 0,14 5,0" fill="${spec.accentColor}" />
           </g>`
        : '';

  let eyesSvgStr = '';
  if (spec.eyeStyle === 'aperture-iris') {
    const r = Math.max(12, Math.min(26, (22 * Math.min(m.leftH, m.rightH)) / 28 + 5));
    eyesSvgStr = `
      <circle cx="${cx}" cy="${eyeCenterY}" r="${r + 7}" fill="none" stroke="${spec.secondaryColor}" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="6 4" />
      <circle cx="${cx}" cy="${eyeCenterY}" r="${r}" fill="none" stroke="${spec.accentColor}" stroke-width="4" />
      <circle cx="${cx}" cy="${eyeCenterY}" r="${(r * 0.48).toFixed(1)}" fill="${spec.accentColor}" />
    `;
  } else if (spec.eyeStyle === 'waveform-visor') {
    const bars = [-38, -24, -10, 4, 18, 32].map((dx, i) => {
      const h = clamp((10 + ((i * 7) % 14) + pose.mouthOpen * 16) * pose.blinkScaleY, 3, 34);
      return `<rect x="${cx + dx}" y="${(eyeCenterY - h / 2).toFixed(1)}" width="8" height="${h.toFixed(1)}" rx="3" fill="${i % 2 === 0 ? spec.accentColor : spec.secondaryColor}" />`;
    });
    eyesSvgStr = bars.join('\n');
  } else if (spec.eyeStyle === 'minimal-slit') {
    const slitH = clamp(10 * ((pose.leftEyeScaleY + pose.rightEyeScaleY) / 2), 2.5, 16);
    eyesSvgStr = `
      <rect x="${cx - 44}" y="${(eyeCenterY - slitH / 2).toFixed(1)}" width="88" height="${slitH.toFixed(1)}" rx="${(slitH / 2).toFixed(1)}" fill="${spec.accentColor}" fill-opacity="0.28" />
      <rect x="${cx - 18 + pose.eyeLookX * 18}" y="${(eyeCenterY - slitH / 2).toFixed(1)}" width="36" height="${slitH.toFixed(1)}" rx="${(slitH / 2).toFixed(1)}" fill="${spec.accentColor}" />
    `;
  } else {
    eyesSvgStr = `
      <rect x="${cx - m.eyeGap - 9}" y="${(eyeCenterY - m.leftH / 2).toFixed(1)}" width="18" height="${m.leftH.toFixed(1)}" rx="7" fill="${spec.accentColor}" />
      <rect x="${cx + m.eyeGap - 9}" y="${(eyeCenterY - m.rightH / 2).toFixed(1)}" width="18" height="${m.rightH.toFixed(1)}" rx="7" fill="${spec.accentColor}" />
    `;
  }

  const mouthStr =
    pose.mouthOpen > 0.02
      ? m.waveHeights
          .map((h, i) => {
            const x = cx - 26 + i * 12;
            return `<rect x="${x}" y="${(mouthY - h / 2).toFixed(1)}" width="6" height="${h}" rx="3" fill="${spec.secondaryColor}" />`;
          })
          .join('')
      : `<rect x="${cx - 20}" y="${mouthY - 1.5}" width="40" height="3" rx="1.5" fill="${spec.secondaryColor}" fill-opacity="0.45" />`;

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
  <defs>
    <linearGradient id="${gradBodyId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${m.bodyHighlight}" />
      <stop offset="55%" stop-color="${spec.bodyColor}" />
      <stop offset="100%" stop-color="${m.bodyShadow}" />
    </linearGradient>
    <linearGradient id="${gradVisorId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${adjustHex(spec.visorColor, 14)}" />
      <stop offset="100%" stop-color="${spec.visorColor}" />
    </linearGradient>
    <radialGradient id="${glowId}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${spec.accentColor}" stop-opacity="0.28" />
      <stop offset="100%" stop-color="${spec.accentColor}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <circle cx="160" cy="156" r="136" fill="url(#${glowId})" />
  <ellipse cx="160" cy="278" rx="${(76 * m.shadowScale).toFixed(1)}" ry="${(12 * m.shadowScale).toFixed(1)}" fill="#000000" fill-opacity="0.38" />
  <g transform="translate(160 ${(160 + m.hoverOffsetPx).toFixed(2)}) scale(${m.entryScale.toFixed(3)}) rotate(${m.tiltDeg.toFixed(2)}) translate(-160 -160)">
    ${accessoryBackStr}
    <g transform="translate(${m.pxBody.toFixed(2)} ${m.pyBody.toFixed(2)})">
      ${chassisSvgStr}
      <line x1="${m.bodyX + 24}" y1="${m.bodyY + 12}" x2="${m.bodyX + m.bodyW - 24}" y2="${m.bodyY + 12}" stroke="#ffffff" stroke-opacity="${m.glossOpacity}" stroke-width="3" stroke-linecap="round" />
    </g>
    <g transform="translate(${m.pxVisor.toFixed(2)} ${m.pyVisor.toFixed(2)})">
      <rect x="${m.visorX}" y="${m.visorY}" width="${m.visorW}" height="${m.visorH}" rx="${m.visorRadius}" fill="url(#${gradVisorId})" stroke="${spec.accentColor}" stroke-opacity="0.5" stroke-width="2" />
      ${accessoryFrontStr}
    </g>
    <g transform="translate(${m.pxEye.toFixed(2)} ${m.pyEye.toFixed(2)})">
      ${eyesSvgStr}
      ${mouthStr}
    </g>
  </g>
</svg>`;

  const defs = (
    <defs>
      <linearGradient id={gradBodyId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={m.bodyHighlight} />
        <stop offset="55%" stopColor={spec.bodyColor} />
        <stop offset="100%" stopColor={m.bodyShadow} />
      </linearGradient>
      <linearGradient id={gradVisorId} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor={adjustHex(spec.visorColor, 14)} />
        <stop offset="100%" stopColor={spec.visorColor} />
      </linearGradient>
      <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={spec.accentColor} stopOpacity={0.28} />
        <stop offset="100%" stopColor={spec.accentColor} stopOpacity={0} />
      </radialGradient>
    </defs>
  );

  const content = (
    <>
      <circle cx={160} cy={156} r={136} fill={`url(#${glowId})`} />
      <ellipse
        cx={160}
        cy={278}
        rx={76 * m.shadowScale}
        ry={12 * m.shadowScale}
        fill="#000000"
        fillOpacity={0.38}
      />

      <g
        transform={`translate(160 ${(160 + m.hoverOffsetPx).toFixed(2)}) scale(${m.entryScale.toFixed(3)}) rotate(${m.tiltDeg.toFixed(2)}) translate(-160 -160)`}
      >
        {spec.accessory === 'halo-ring' ? (
          <g
            transform={`translate(${cx + m.pxBack} ${150 + m.pyBack}) rotate(${haloRotDeg.toFixed(2)})`}
          >
            <ellipse
              cx={0}
              cy={0}
              rx={124}
              ry={42}
              fill="none"
              stroke={spec.accentColor}
              strokeWidth={4}
              strokeOpacity={0.72}
            />
            <circle cx={124} cy={0} r={6} fill={spec.secondaryColor} />
          </g>
        ) : null}

        {spec.accessory === 'antenna-pin' ? (
          <g transform={`translate(${m.pxBody.toFixed(2)} ${m.pyBody.toFixed(2)})`}>
            <line
              x1={cx + 38}
              y1={m.bodyY + 6}
              x2={cx + 46}
              y2={m.bodyY - 34}
              stroke={spec.secondaryColor}
              strokeWidth={4}
              strokeLinecap="round"
            />
            <circle cx={cx + 46} cy={m.bodyY - 38} r={7} fill={spec.accentColor} />
          </g>
        ) : null}

        <g transform={`translate(${m.pxBody.toFixed(2)} ${m.pyBody.toFixed(2)})`}>
          {spec.chassis === 'cyber-prism' ? (
            <>
              <polygon
                points={prismPoints}
                fill={`url(#${gradBodyId})`}
                stroke={m.bodyHighlight}
                strokeWidth={2.5}
              />
              <polygon
                points={prismRimPoints}
                fill="none"
                stroke={spec.accentColor}
                strokeOpacity={0.32}
                strokeWidth={1.2}
              />
            </>
          ) : (
            <rect
              x={m.bodyX}
              y={m.bodyY}
              width={m.bodyW}
              height={m.bodyH}
              rx={m.bodyRadius}
              fill={`url(#${gradBodyId})`}
              stroke={m.bodyHighlight}
              strokeWidth={2.5}
            />
          )}

          {spec.chassis === 'braun-pod' ? (
            <g fill={m.bodyShadow} fillOpacity={0.7}>
              {[-10, 0, 10].map((dx) =>
                [-8, 0, 8].map((dy) => (
                  <circle
                    key={`${dx}-${dy}`}
                    cx={cx + dx}
                    cy={m.bodyY + m.bodyH - 22 + dy}
                    r={2.2}
                  />
                )),
              )}
            </g>
          ) : null}

          <line
            x1={m.bodyX + 24}
            y1={m.bodyY + 12}
            x2={m.bodyX + m.bodyW - 24}
            y2={m.bodyY + 12}
            stroke="#ffffff"
            strokeOpacity={m.glossOpacity}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>

        <g transform={`translate(${m.pxVisor.toFixed(2)} ${m.pyVisor.toFixed(2)})`}>
          <rect
            x={m.visorX}
            y={m.visorY}
            width={m.visorW}
            height={m.visorH}
            rx={m.visorRadius}
            fill={`url(#${gradVisorId})`}
            stroke={spec.accentColor}
            strokeOpacity={0.5}
            strokeWidth={2}
          />
          {spec.accessory === 'visor-hood' ? (
            <path
              d={`M ${m.visorX - 8} ${m.visorY + 14} Q ${cx} ${m.visorY - 18} ${m.visorX + m.visorW + 8} ${m.visorY + 14} L ${m.visorX + m.visorW + 2} ${m.visorY + 2} Q ${cx} ${m.visorY - 26} ${m.visorX - 2} ${m.visorY + 2} Z`}
              fill={m.bodyHighlight}
              stroke={spec.accentColor}
              strokeOpacity={0.45}
              strokeWidth={1.5}
            />
          ) : null}
          {spec.accessory === 'floating-pointer' ? (
            <g
              transform={`translate(${cx + m.bodyW / 2 + 26 + m.pxVisor * 0.4} ${(164 + pointerBobY).toFixed(1)})`}
            >
              <polygon points="0,-14 22,0 0,14 5,0" fill={spec.accentColor} />
            </g>
          ) : null}
        </g>

        <g transform={`translate(${m.pxEye.toFixed(2)} ${m.pyEye.toFixed(2)})`}>
          {spec.eyeStyle === 'aperture-iris' ? (
            (() => {
              const r = Math.max(
                12,
                Math.min(26, (22 * Math.min(m.leftH, m.rightH)) / 28 + 5),
              );
              return (
                <>
                  <circle
                    cx={cx}
                    cy={eyeCenterY}
                    r={r + 7}
                    fill="none"
                    stroke={spec.secondaryColor}
                    strokeOpacity={0.45}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                  <circle
                    cx={cx}
                    cy={eyeCenterY}
                    r={r}
                    fill="none"
                    stroke={spec.accentColor}
                    strokeWidth={4}
                  />
                  <circle cx={cx} cy={eyeCenterY} r={r * 0.48} fill={spec.accentColor} />
                </>
              );
            })()
          ) : spec.eyeStyle === 'waveform-visor' ? (
            [-38, -24, -10, 4, 18, 32].map((dx, i) => {
              const h = clamp(
                (10 + ((i * 7) % 14) + pose.mouthOpen * 16) * pose.blinkScaleY,
                3,
                34,
              );
              return (
                <rect
                  key={dx}
                  x={cx + dx}
                  y={eyeCenterY - h / 2}
                  width={8}
                  height={h}
                  rx={3}
                  fill={i % 2 === 0 ? spec.accentColor : spec.secondaryColor}
                />
              );
            })
          ) : spec.eyeStyle === 'minimal-slit' ? (
            (() => {
              const slitH = clamp(
                10 * ((pose.leftEyeScaleY + pose.rightEyeScaleY) / 2),
                2.5,
                16,
              );
              return (
                <>
                  <rect
                    x={cx - 44}
                    y={eyeCenterY - slitH / 2}
                    width={88}
                    height={slitH}
                    rx={slitH / 2}
                    fill={spec.accentColor}
                    fillOpacity={0.28}
                  />
                  <rect
                    x={cx - 18 + pose.eyeLookX * 18}
                    y={eyeCenterY - slitH / 2}
                    width={36}
                    height={slitH}
                    rx={slitH / 2}
                    fill={spec.accentColor}
                  />
                </>
              );
            })()
          ) : (
            <>
              <rect
                x={cx - m.eyeGap - 9}
                y={eyeCenterY - m.leftH / 2}
                width={18}
                height={m.leftH}
                rx={7}
                fill={spec.accentColor}
              />
              <rect
                x={cx + m.eyeGap - 9}
                y={eyeCenterY - m.rightH / 2}
                width={18}
                height={m.rightH}
                rx={7}
                fill={spec.accentColor}
              />
            </>
          )}

          {pose.mouthOpen > 0.02 ? (
            m.waveHeights.map((h, i) => (
              <rect
                key={i}
                x={cx - 26 + i * 12}
                y={mouthY - h / 2}
                width={6}
                height={h}
                rx={3}
                fill={spec.secondaryColor}
              />
            ))
          ) : (
            <rect
              x={cx - 20}
              y={mouthY - 1.5}
              width={40}
              height={3}
              rx={1.5}
              fill={spec.secondaryColor}
              fillOpacity={0.45}
            />
          )}
        </g>
      </g>
    </>
  );

  return { defs, content, svgString };
}

export function serializeOpticToSvgString(
  spec: OpticAvatarSpec,
  expression: OpticExpression = spec.defaultExpression,
): string {
  const pose = computeOpticPoseState({
    timeSec: 0.8,
    expression,
    talkLevel: expression === 'talking' ? 0.65 : 0,
    hoverAmplitude: spec.hoverAmplitude,
  });
  return buildCoreSvgInner(spec, pose, 'opticrig_avatar').svgString;
}

export const OpticVector25D: React.FC<OpticVector25DProps> = ({
  spec,
  pose,
  expression,
  timeSec = 0,
  talkLevel = 0,
  size = 220,
  className,
}) => {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '_');
  const resolvedPose =
    pose ??
    computeOpticPoseState({
      timeSec,
      expression: expression ?? spec.defaultExpression,
      talkLevel,
      hoverAmplitude: spec.hoverAmplitude,
    });

  const { defs, content } = buildCoreSvgInner(spec, resolvedPose, `av_${reactId}`);

  return (
    <svg
      viewBox="0 0 320 320"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', overflow: 'visible' }}
      role="img"
      aria-label="OpticRig Mascot 2.5D"
    >
      {defs}
      {content}
    </svg>
  );
};
