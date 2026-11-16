import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OpticVector25D } from './OpticVector25D.tsx';
import { computeOpticPoseState } from './rig-math.ts';
import {
  applyPoseToOpticRig,
  buildOpticThreeRig,
  loadCustomGlbNormalized,
  type BuiltOpticRig,
} from './three-rig.ts';
import type { OpticAvatarSpec, OpticCameraPreset, OpticExpression } from './types.ts';

export interface OpticAvatarProps {
  spec: OpticAvatarSpec;
  expression?: OpticExpression;
  talkLevel?: number;
  deterministicTimeSec?: number;
  entryProgress?: number;
  size?: number;
  interactive?: boolean;
  cameraPreset?: OpticCameraPreset;
  className?: string;
  onCanvasMount?: (canvas: HTMLCanvasElement | null) => void;
}

function getCameraAnglesForPreset(preset: OpticCameraPreset): { yaw: number; pitch: number } {
  switch (preset) {
    case 'side':
      return { yaw: 0.72, pitch: -0.06 };
    case 'three-quarter':
      return { yaw: 0.36, pitch: -0.1 };
    case 'front':
    default:
      return { yaw: 0, pitch: -0.04 };
  }
}

const LiveOptic25D: React.FC<
  Omit<OpticAvatarProps, 'interactive' | 'cameraPreset' | 'onCanvasMount'>
> = ({ spec, expression, talkLevel = 0, deterministicTimeSec, entryProgress = 1, size = 240, className }) => {
  const [liveSec, setLiveSec] = useState(0);

  useEffect(() => {
    if (deterministicTimeSec !== undefined) return;
    let rafId = 0;
    const startMs = performance.now();
    const tick = (nowMs: number) => {
      setLiveSec((nowMs - startMs) / 1000);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [deterministicTimeSec]);

  const timeSec = deterministicTimeSec ?? liveSec;
  const pose = computeOpticPoseState({
    timeSec,
    expression: expression ?? spec.defaultExpression,
    talkLevel,
    entryProgress,
    hoverAmplitude: spec.hoverAmplitude,
  });

  return <OpticVector25D spec={spec} pose={pose} size={size} className={className} />;
};

const OpticThreeCanvas: React.FC<OpticAvatarProps> = ({
  spec,
  expression,
  talkLevel = 0,
  deterministicTimeSec,
  entryProgress = 1,
  size = 240,
  interactive = false,
  cameraPreset = 'three-quarter',
  className,
  onCanvasMount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rigRef = useRef<BuiltOpticRig | null>(null);
  const customGroupRef = useRef<THREE.Group | null>(null);

  const orbitRef = useRef<{ yaw: number; pitch: number }>({
    ...getCameraAnglesForPreset(cameraPreset),
  });
  const dragRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
  }>({ active: false, lastX: 0, lastY: 0 });

  const latestPropsRef = useRef({
    spec,
    expression: expression ?? spec.defaultExpression,
    talkLevel,
    entryProgress,
  });
  latestPropsRef.current = {
    spec,
    expression: expression ?? spec.defaultExpression,
    talkLevel,
    entryProgress,
  };

  useLayoutEffect(() => {
    orbitRef.current = getCameraAnglesForPreset(cameraPreset);
  }, [cameraPreset]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onCanvasMount?.(canvas);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      onCanvasMount?.(null);
      return;
    }

    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    camera.position.set(0, 0.18, 5.2);
    camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight('#f8fafc', '#0f172a', 1.35);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#ffffff', 1.85);
    keyLight.position.set(3.2, 4.2, 4.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#94a3b8', 0.65);
    fillLight.position.set(-3.5, 1.0, 2.6);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(latestPropsRef.current.spec.accentColor, 1.45);
    rimLight.position.set(-2.6, 2.8, -3.6);
    scene.add(rimLight);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    rimLightRef.current = rimLight;

    return () => {
      onCanvasMount?.(null);
      if (rigRef.current) {
        scene.remove(rigRef.current.root);
        rigRef.current.dispose();
        rigRef.current = null;
      }
      if (customGroupRef.current) {
        scene.remove(customGroupRef.current);
        customGroupRef.current = null;
      }
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rimLightRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
  }, [size]);

  const specSignature = JSON.stringify({
    chassis: spec.chassis,
    eyeStyle: spec.eyeStyle,
    mouthStyle: spec.mouthStyle ?? 'equalizer-bars',
    accessory: spec.accessory,
    sideAddon: spec.sideAddon ?? 'none',
    materialFinish: spec.materialFinish,
    bodyColor: spec.bodyColor,
    visorColor: spec.visorColor,
    accentColor: spec.accentColor,
    secondaryColor: spec.secondaryColor,
    roundness: spec.roundness,
    visorScale: spec.visorScale,
    eyeSpacing: spec.eyeSpacing,
    glowIntensity: spec.glowIntensity ?? 1,
    bodyStretchY: spec.bodyStretchY ?? 1,
    customGlbUrl: spec.customGlbUrl ?? null,
  });

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene || webglFailed) return;

    if (rigRef.current) {
      scene.remove(rigRef.current.root);
      rigRef.current.dispose();
      rigRef.current = null;
    }
    if (customGroupRef.current) {
      scene.remove(customGroupRef.current);
      customGroupRef.current = null;
    }

    if (rimLightRef.current) {
      rimLightRef.current.color.set(spec.accentColor);
    }

    const rig = buildOpticThreeRig(spec);
    scene.add(rig.root);
    rigRef.current = rig;

    let cancelled = false;
    if (spec.customGlbUrl) {
      loadCustomGlbNormalized(spec.customGlbUrl)
        .then((group) => {
          if (cancelled || !sceneRef.current) return;
          if (rigRef.current) {
            rigRef.current.root.visible = false;
          }
          const wrap = new THREE.Group();
          wrap.add(group);
          sceneRef.current.add(wrap);
          customGroupRef.current = wrap;
        })
        .catch(() => {
          if (rigRef.current) rigRef.current.root.visible = true;
        });
    }

    return () => {
      cancelled = true;
    };
  }, [specSignature, webglFailed]);

  useLayoutEffect(() => {
    if (deterministicTimeSec === undefined || webglFailed) return;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const rig = rigRef.current;
    if (!renderer || !scene || !camera || !rig) return;

    const pose = computeOpticPoseState({
      timeSec: deterministicTimeSec,
      expression: expression ?? spec.defaultExpression,
      talkLevel,
      entryProgress,
      orbitYawRad: orbitRef.current.yaw,
      orbitPitchRad: orbitRef.current.pitch,
      hoverAmplitude: spec.hoverAmplitude,
    });

    applyPoseToOpticRig(rig, pose, spec);
    if (customGroupRef.current) {
      customGroupRef.current.position.y = pose.hoverY;
      customGroupRef.current.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll);
      customGroupRef.current.scale.setScalar(pose.entryScale);
    }
    renderer.render(scene, camera);
  }, [deterministicTimeSec, expression, talkLevel, entryProgress, specSignature, cameraPreset, webglFailed]);

  useEffect(() => {
    if (deterministicTimeSec !== undefined || webglFailed) return;
    let rafId = 0;
    const startMs = performance.now();

    const tick = (nowMs: number) => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const rig = rigRef.current;
      const cur = latestPropsRef.current;

      if (renderer && scene && camera && rig) {
        const timeSec = (nowMs - startMs) / 1000;
        const pose = computeOpticPoseState({
          timeSec,
          expression: cur.expression,
          talkLevel: cur.talkLevel,
          entryProgress: cur.entryProgress,
          orbitYawRad: orbitRef.current.yaw,
          orbitPitchRad: orbitRef.current.pitch,
          hoverAmplitude: cur.spec.hoverAmplitude,
        });
        applyPoseToOpticRig(rig, pose, cur.spec);
        if (customGroupRef.current) {
          customGroupRef.current.position.y = pose.hoverY;
          customGroupRef.current.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll);
          customGroupRef.current.scale.setScalar(pose.entryScale);
        }
        renderer.render(scene, camera);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [deterministicTimeSec, webglFailed]);

  if (webglFailed) {
    return (
      <OpticVector25D
        spec={spec}
        expression={expression}
        timeSec={deterministicTimeSec ?? 0}
        talkLevel={talkLevel}
        size={size}
        className={className}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        display: 'block',
        cursor: interactive ? 'grab' : 'default',
        touchAction: interactive ? 'none' : 'auto',
      }}
      onPointerDown={
        interactive
          ? (e) => {
              dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
              (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
            }
          : undefined
      }
      onPointerMove={
        interactive
          ? (e) => {
              if (!dragRef.current.active) return;
              const dx = e.clientX - dragRef.current.lastX;
              const dy = e.clientY - dragRef.current.lastY;
              dragRef.current.lastX = e.clientX;
              dragRef.current.lastY = e.clientY;
              orbitRef.current.yaw += dx * 0.012;
              orbitRef.current.pitch = Math.max(
                -0.65,
                Math.min(0.65, orbitRef.current.pitch + dy * 0.01),
              );
            }
          : undefined
      }
      onPointerUp={
        interactive
          ? (e) => {
              dragRef.current.active = false;
              if ((e.currentTarget as HTMLCanvasElement).hasPointerCapture(e.pointerId)) {
                (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
              }
            }
          : undefined
      }
      onPointerCancel={
        interactive
          ? () => {
              dragRef.current.active = false;
            }
          : undefined
      }
    />
  );
};

export const OpticAvatar: React.FC<OpticAvatarProps> = (props) => {
  const { spec, onCanvasMount } = props;

  useEffect(() => {
    if (spec.renderEngine === '2.5d') {
      onCanvasMount?.(null);
    }
  }, [spec.renderEngine, onCanvasMount]);

  if (spec.renderEngine === '2.5d') {
    return (
      <LiveOptic25D
        spec={spec}
        expression={props.expression}
        talkLevel={props.talkLevel}
        deterministicTimeSec={props.deterministicTimeSec}
        entryProgress={props.entryProgress}
        size={props.size}
        className={props.className}
      />
    );
  }
  return <OpticThreeCanvas {...props} />;
};
