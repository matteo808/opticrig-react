import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildStylizedThreeRig } from './three-toon-rig.ts';
import type { OpticPoseState } from './rig-math.ts';
import type { OpticAvatarSpec, OpticMaterialFinish } from './types.ts';

export interface BuiltOpticRig {
  root: THREE.Group;
  hoverPivot: THREE.Group;
  headGroup: THREE.Group;
  eyeLeft: THREE.Object3D | null;
  eyeRight: THREE.Object3D | null;
  irisRing: THREE.Mesh | null;
  irisCore: THREE.Object3D | null;
  slitMarker: THREE.Mesh | null;
  waveformEyeBars: THREE.Mesh[];
  speechBars: THREE.Mesh[];
  mouthCoreMesh: THREE.Mesh | null;
  accessoryGroup: THREE.Group;
  haloRing: THREE.Mesh | null;
  floatingPointer: THREE.Mesh | null;
  beaconMesh: THREE.Mesh | null;
  accentMat: THREE.MeshStandardMaterial;
  secondaryMat: THREE.MeshStandardMaterial;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  dispose: () => void;
}

function getFinishProperties(finish: OpticMaterialFinish): {
  roughness: number;
  metalness: number;
} {
  switch (finish) {
    case 'matte-ceramic':
      return { roughness: 0.78, metalness: 0.06 };
    case 'obsidian-glass':
      return { roughness: 0.14, metalness: 0.38 };
    case 'warm-bakelite':
      return { roughness: 0.46, metalness: 0.14 };
    case 'anodized-alloy':
    default:
      return { roughness: 0.34, metalness: 0.74 };
  }
}

export function buildOpticThreeRig(spec: OpticAvatarSpec): BuiltOpticRig {
  const universe = spec.universe ?? 'tech';
  if (
    universe === 'anime' ||
    universe === 'animal' ||
    universe === 'comic' ||
    universe === 'pixel' ||
    universe === 'custom-art' ||
    spec.customSprites?.idleUrl
  ) {
    return buildStylizedThreeRig(spec);
  }

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const root = new THREE.Group();
  root.name = 'OpticRigRoot';

  const hoverPivot = new THREE.Group();
  hoverPivot.name = 'HoverPivot';
  root.add(hoverPivot);

  const headGroup = new THREE.Group();
  headGroup.name = 'HeadGroup';
  headGroup.scale.set(1, spec.bodyStretchY ?? 1, 1);
  hoverPivot.add(headGroup);

  const finishProps = getFinishProperties(spec.materialFinish);
  const bodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.bodyColor),
      roughness: finishProps.roughness,
      metalness: finishProps.metalness,
    }),
  );

  const frameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.bodyColor).multiplyScalar(0.76),
      roughness: Math.min(0.95, finishProps.roughness + 0.12),
      metalness: Math.max(0.15, finishProps.metalness),
    }),
  );

  const visorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.visorColor),
      roughness: 0.16,
      metalness: 0.25,
    }),
  );

  const glowScale = Math.max(0.3, Math.min(2.0, spec.glowIntensity ?? 1));
  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.accentColor),
      emissive: new THREE.Color(spec.accentColor),
      emissiveIntensity: 1.25 * glowScale,
      roughness: 0.25,
      metalness: 0.1,
    }),
  );

  const secondaryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.secondaryColor),
      emissive: new THREE.Color(spec.secondaryColor),
      emissiveIntensity: 0.65 * glowScale,
      roughness: 0.3,
      metalness: 0.25,
    }),
  );

  // 1. 8 Sculpted Chassis Silhouettes
  let visorZ = 0.64;
  let bodyHalfW = 0.92;
  let bodyTopY = 0.96;

  if (spec.chassis === 'orbital-core') {
    const sphereGeo = trackGeo(new THREE.SphereGeometry(1.06, 36, 28));
    const sphereMesh = new THREE.Mesh(sphereGeo, bodyMat);
    sphereMesh.name = 'ChassisMesh';
    headGroup.add(sphereMesh);

    const eqGeo = trackGeo(new THREE.TorusGeometry(1.08, 0.045, 16, 48));
    const eqRing = new THREE.Mesh(eqGeo, frameMat);
    eqRing.name = 'EquatorialCollar';
    eqRing.rotation.x = Math.PI / 2;
    headGroup.add(eqRing);
    visorZ = 0.86;
    bodyHalfW = 1.06;
    bodyTopY = 1.04;
  } else if (spec.chassis === 'cyber-prism') {
    const prismGeo = trackGeo(new THREE.CylinderGeometry(1.08, 1.02, 1.92, 8, 1));
    const prismMesh = new THREE.Mesh(prismGeo, bodyMat);
    prismMesh.name = 'ChassisMesh';
    prismMesh.rotation.y = Math.PI / 8;
    headGroup.add(prismMesh);

    const topCapGeo = trackGeo(new THREE.CylinderGeometry(0.76, 1.08, 0.2, 8, 1));
    const topCap = new THREE.Mesh(topCapGeo, frameMat);
    topCap.name = 'PrismCrown';
    topCap.position.y = 1.06;
    topCap.rotation.y = Math.PI / 8;
    headGroup.add(topCap);
    visorZ = 0.88;
    bodyHalfW = 1.05;
    bodyTopY = 1.12;
  } else if (spec.chassis === 'braun-pod') {
    const radius = 0.24 + spec.roundness * 0.34;
    const podGeo = trackGeo(new RoundedBoxGeometry(2.02, 1.72, 1.24, 5, radius));
    const podMesh = new THREE.Mesh(podGeo, bodyMat);
    podMesh.name = 'ChassisMesh';
    headGroup.add(podMesh);

    const dialGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 24));
    const dialMesh = new THREE.Mesh(dialGeo, accentMat);
    dialMesh.name = 'SideRotaryDial';
    dialMesh.rotation.z = Math.PI / 2;
    dialMesh.position.set(1.04, -0.18, 0.12);
    headGroup.add(dialMesh);

    const grilleGeo = trackGeo(new THREE.BoxGeometry(0.72, 0.04, 0.04));
    for (let row = 0; row < 3; row++) {
      const vent = new THREE.Mesh(grilleGeo, frameMat);
      vent.position.set(0, -0.58 - row * 0.09, 0.62);
      headGroup.add(vent);
    }
    visorZ = 0.63;
    bodyHalfW = 1.01;
    bodyTopY = 0.86;
  } else if (spec.chassis === 'crt-monitor') {
    const crtRadius = 0.14 + spec.roundness * 0.22;
    const shellGeo = trackGeo(new RoundedBoxGeometry(2.08, 1.78, 1.46, 5, crtRadius));
    const shellMesh = new THREE.Mesh(shellGeo, bodyMat);
    shellMesh.name = 'ChassisMesh';
    shellMesh.rotation.x = -0.04;
    headGroup.add(shellMesh);

    // Tapered CRT rear hump
    const tubeBackGeo = trackGeo(new RoundedBoxGeometry(1.36, 1.12, 0.56, 3, 0.18));
    const tubeBack = new THREE.Mesh(tubeBackGeo, frameMat);
    tubeBack.name = 'CrtRearHousing';
    tubeBack.position.set(0, 0.02, -0.78);
    headGroup.add(tubeBack);

    // Desk neck & base plate
    const neckGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.3, 0.28, 24));
    const neck = new THREE.Mesh(neckGeo, frameMat);
    neck.name = 'CrtNeck';
    neck.position.set(0, -0.98, -0.05);
    headGroup.add(neck);

    const discGeo = trackGeo(new THREE.CylinderGeometry(0.72, 0.78, 0.12, 32));
    const disc = new THREE.Mesh(discGeo, frameMat);
    disc.name = 'CrtStandBase';
    disc.position.set(0, -1.14, 0.04);
    headGroup.add(disc);
    visorZ = 0.74;
    bodyHalfW = 1.04;
    bodyTopY = 0.89;
  } else if (spec.chassis === 'capsule-pill') {
    const pillGeo = trackGeo(new RoundedBoxGeometry(2.34, 1.44, 1.24, 6, 0.62));
    const pillMesh = new THREE.Mesh(pillGeo, bodyMat);
    pillMesh.name = 'ChassisMesh';
    headGroup.add(pillMesh);

    const seamGeo = trackGeo(new THREE.TorusGeometry(0.92, 0.028, 12, 48));
    const seam = new THREE.Mesh(seamGeo, frameMat);
    seam.scale.set(1.24, 0.76, 1);
    seam.position.z = 0.1;
    headGroup.add(seam);
    visorZ = 0.62;
    bodyHalfW = 1.17;
    bodyTopY = 0.72;
  } else if (spec.chassis === 'tactile-cube') {
    const radius = 0.18 + spec.roundness * 0.28;
    const cubeGeo = trackGeo(new RoundedBoxGeometry(1.78, 1.78, 1.62, 5, radius));
    const cubeMesh = new THREE.Mesh(cubeGeo, bodyMat);
    cubeMesh.name = 'ChassisMesh';
    headGroup.add(cubeMesh);

    const footGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 0.14, 16));
    [
      [-0.56, -0.94, 0.45],
      [0.56, -0.94, 0.45],
      [-0.56, -0.94, -0.45],
      [0.56, -0.94, -0.45],
    ].forEach(([fx, fy, fz], idx) => {
      const foot = new THREE.Mesh(footGeo, frameMat);
      foot.name = `CubeFoot_${idx}`;
      foot.position.set(fx!, fy!, fz!);
      headGroup.add(foot);
    });
    visorZ = 0.82;
    bodyHalfW = 0.89;
    bodyTopY = 0.89;
  } else if (spec.chassis === 'drone-shell') {
    const podGeo = trackGeo(new THREE.SphereGeometry(1.18, 36, 24));
    const podMesh = new THREE.Mesh(podGeo, bodyMat);
    podMesh.name = 'ChassisMesh';
    podMesh.scale.set(1.12, 0.76, 0.96);
    headGroup.add(podMesh);

    const rimGeo = trackGeo(new THREE.TorusGeometry(1.24, 0.045, 16, 48));
    const rim = new THREE.Mesh(rimGeo, accentMat);
    rim.name = 'DroneGlowTrim';
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1.04, 0.88, 1);
    rim.position.y = -0.1;
    headGroup.add(rim);
    visorZ = 0.88;
    bodyHalfW = 1.28;
    bodyTopY = 0.86;
  } else {
    const radius = 0.05 + spec.roundness * 0.2;
    const monoGeo = trackGeo(new RoundedBoxGeometry(1.76, 2.08, 1.18, 4, radius));
    const monoMesh = new THREE.Mesh(monoGeo, bodyMat);
    monoMesh.name = 'ChassisMesh';
    headGroup.add(monoMesh);

    const baseGeo = trackGeo(new RoundedBoxGeometry(1.42, 0.14, 0.96, 3, 0.04));
    const baseMesh = new THREE.Mesh(baseGeo, frameMat);
    baseMesh.name = 'MonolithPedestal';
    baseMesh.position.y = -1.1;
    headGroup.add(baseMesh);
    visorZ = 0.6;
    bodyHalfW = 0.88;
    bodyTopY = 1.04;
  }

  // 2. Recessed Visor Frame & Glass
  const vScale = Math.max(0.75, Math.min(1.25, spec.visorScale));
  const visorW = 1.46 * vScale;
  const visorH = 0.92 * vScale;

  const visorFrameGeo = trackGeo(
    new RoundedBoxGeometry(visorW + 0.1, visorH + 0.1, 0.12, 3, 0.12),
  );
  const visorFrame = new THREE.Mesh(visorFrameGeo, frameMat);
  visorFrame.name = 'VisorFrame';
  visorFrame.position.set(0, 0.12, visorZ);
  headGroup.add(visorFrame);

  const visorGlassGeo = trackGeo(new RoundedBoxGeometry(visorW, visorH, 0.08, 3, 0.1));
  const visorGlass = new THREE.Mesh(visorGlassGeo, visorMat);
  visorGlass.name = 'VisorGlass';
  visorGlass.position.set(0, 0.12, visorZ + 0.045);
  headGroup.add(visorGlass);

  // 3. 8 Eye Styles
  const eyeZ = visorZ + 0.105;
  const eyeY = 0.18;
  const eyeGap = 0.3 * Math.max(0.75, Math.min(1.3, spec.eyeSpacing));

  let eyeLeft: THREE.Object3D | null = null;
  let eyeRight: THREE.Object3D | null = null;
  let irisRing: THREE.Mesh | null = null;
  let irisCore: THREE.Object3D | null = null;
  let slitMarker: THREE.Mesh | null = null;
  const waveformEyeBars: THREE.Mesh[] = [];

  if (spec.eyeStyle === 'aperture-iris') {
    const ringGeo = trackGeo(new THREE.TorusGeometry(0.24, 0.045, 16, 36));
    irisRing = new THREE.Mesh(ringGeo, accentMat);
    irisRing.name = 'IrisRing';
    irisRing.position.set(0, eyeY, eyeZ);
    headGroup.add(irisRing);

    const coreGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 24));
    const core = new THREE.Mesh(coreGeo, secondaryMat);
    core.name = 'IrisCore';
    core.rotation.x = Math.PI / 2;
    core.position.set(0, eyeY, eyeZ + 0.01);
    headGroup.add(core);
    irisCore = core;
  } else if (spec.eyeStyle === 'cyclops-orb') {
    const outerGeo = trackGeo(new THREE.TorusGeometry(0.3, 0.032, 14, 36));
    irisRing = new THREE.Mesh(outerGeo, secondaryMat);
    irisRing.name = 'CyclopsRing';
    irisRing.position.set(0, eyeY, eyeZ);
    headGroup.add(irisRing);

    const orbGeo = trackGeo(new THREE.SphereGeometry(0.18, 24, 20));
    const orb = new THREE.Mesh(orbGeo, accentMat);
    orb.name = 'CyclopsCore';
    orb.position.set(0, eyeY, eyeZ + 0.02);
    headGroup.add(orb);
    irisCore = orb;
  } else if (spec.eyeStyle === 'crosshair-hud') {
    const ringGeo = trackGeo(new THREE.TorusGeometry(0.24, 0.026, 12, 36));
    irisRing = new THREE.Mesh(ringGeo, accentMat);
    irisRing.name = 'CrosshairOuter';
    irisRing.position.set(0, eyeY, eyeZ);
    headGroup.add(irisRing);

    const crosshairGroup = new THREE.Group();
    crosshairGroup.name = 'CrosshairReticle';
    crosshairGroup.position.set(0, eyeY, eyeZ + 0.01);
    const hTickGeo = trackGeo(new THREE.BoxGeometry(0.64, 0.035, 0.03));
    const vTickGeo = trackGeo(new THREE.BoxGeometry(0.035, 0.56, 0.03));
    const dotGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16));
    crosshairGroup.add(new THREE.Mesh(hTickGeo, secondaryMat));
    crosshairGroup.add(new THREE.Mesh(vTickGeo, secondaryMat));
    const centerDot = new THREE.Mesh(dotGeo, accentMat);
    centerDot.rotation.x = Math.PI / 2;
    crosshairGroup.add(centerDot);
    headGroup.add(crosshairGroup);
    irisCore = crosshairGroup;
  } else if (spec.eyeStyle === 'waveform-visor') {
    const barGeo = trackGeo(new RoundedBoxGeometry(0.1, 0.26, 0.05, 2, 0.02));
    const offsets = [-0.45, -0.27, -0.09, 0.09, 0.27, 0.45];
    offsets.forEach((ox, idx) => {
      const bar = new THREE.Mesh(barGeo, idx % 2 === 0 ? accentMat : secondaryMat);
      bar.name = `EyeWaveformBar_${idx}`;
      bar.position.set(ox, eyeY, eyeZ);
      headGroup.add(bar);
      waveformEyeBars.push(bar);
    });
  } else if (spec.eyeStyle === 'minimal-slit') {
    const trackSlitGeo = trackGeo(new RoundedBoxGeometry(0.98, 0.08, 0.03, 2, 0.03));
    const trackSlit = new THREE.Mesh(trackSlitGeo, frameMat);
    trackSlit.name = 'MinimalSlitTrack';
    trackSlit.position.set(0, eyeY, eyeZ - 0.01);
    headGroup.add(trackSlit);

    const markerGeo = trackGeo(new RoundedBoxGeometry(0.34, 0.1, 0.05, 2, 0.03));
    slitMarker = new THREE.Mesh(markerGeo, accentMat);
    slitMarker.name = 'MinimalSlitScanner';
    slitMarker.position.set(0, eyeY, eyeZ + 0.01);
    headGroup.add(slitMarker);
  } else if (spec.eyeStyle === 'happy-arcs') {
    const arcGeo = trackGeo(new THREE.TorusGeometry(0.16, 0.042, 12, 24, Math.PI));
    const leftArc = new THREE.Mesh(arcGeo, accentMat);
    leftArc.name = 'HappyEyeLeft';
    leftArc.position.set(-eyeGap, eyeY - 0.05, eyeZ);
    headGroup.add(leftArc);
    eyeLeft = leftArc;

    const rightArc = new THREE.Mesh(arcGeo, accentMat);
    rightArc.name = 'HappyEyeRight';
    rightArc.position.set(eyeGap, eyeY - 0.05, eyeZ);
    headGroup.add(rightArc);
    eyeRight = rightArc;
  } else if (spec.eyeStyle === 'pixel-matrix') {
    const pxGeo = trackGeo(new THREE.BoxGeometry(0.068, 0.068, 0.04));
    const buildCluster = (cx: number, name: string) => {
      const grp = new THREE.Group();
      grp.name = name;
      grp.position.set(cx, eyeY, eyeZ);
      [-0.085, 0, 0.085].forEach((dx, xi) => {
        [-0.085, 0, 0.085].forEach((dy, yi) => {
          // Crisp rounded 3x3 sprite cluster (omit outer corners)
          if ((xi === 0 || xi === 2) && (yi === 0 || yi === 2)) return;
          const cell = new THREE.Mesh(pxGeo, accentMat);
          cell.position.set(dx, dy, 0);
          grp.add(cell);
        });
      });
      headGroup.add(grp);
      return grp;
    };
    eyeLeft = buildCluster(-eyeGap, 'PixelEyeLeft');
    eyeRight = buildCluster(eyeGap, 'PixelEyeRight');
  } else {
    const eyeGeo = trackGeo(new RoundedBoxGeometry(0.22, 0.34, 0.06, 3, 0.07));
    const leftMesh = new THREE.Mesh(eyeGeo, accentMat);
    leftMesh.name = 'EyeLeft';
    leftMesh.position.set(-eyeGap, eyeY, eyeZ);
    headGroup.add(leftMesh);
    eyeLeft = leftMesh;

    const rightMesh = new THREE.Mesh(eyeGeo, accentMat);
    rightMesh.name = 'EyeRight';
    rightMesh.position.set(eyeGap, eyeY, eyeZ);
    headGroup.add(rightMesh);
    eyeRight = rightMesh;
  }

  // 4. 5 Mouth Styles
  const mouthStyle = spec.mouthStyle ?? 'equalizer-bars';
  const speechGroup = new THREE.Group();
  speechGroup.name = 'SpeechWaveformBars';
  speechGroup.position.set(0, 0.12 - visorH * 0.31, eyeZ);
  headGroup.add(speechGroup);

  const speechBars: THREE.Mesh[] = [];
  let mouthCoreMesh: THREE.Mesh | null = null;

  if (mouthStyle === 'none') {
    // intentionally clean visor bottom
  } else if (mouthStyle === 'pulse-core') {
    const pillGeo = trackGeo(new RoundedBoxGeometry(0.36, 0.085, 0.04, 2, 0.04));
    mouthCoreMesh = new THREE.Mesh(pillGeo, secondaryMat);
    mouthCoreMesh.name = 'MouthPulseCore';
    speechGroup.add(mouthCoreMesh);
  } else if (mouthStyle === 'speaker-dots') {
    const dotGeo = trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 16));
    [-0.24, -0.12, 0, 0.12, 0.24].forEach((ox, idx) => {
      const dot = new THREE.Mesh(dotGeo, secondaryMat);
      dot.name = `MouthDot_${idx}`;
      dot.rotation.x = Math.PI / 2;
      dot.position.set(ox, 0, 0);
      speechGroup.add(dot);
      speechBars.push(dot);
    });
  } else if (mouthStyle === 'oscilloscope-line') {
    const segGeo = trackGeo(new RoundedBoxGeometry(0.078, 0.032, 0.04, 2, 0.014));
    [-0.27, -0.18, -0.09, 0, 0.09, 0.18, 0.27].forEach((ox, idx) => {
      const seg = new THREE.Mesh(segGeo, secondaryMat);
      seg.name = `MouthOscSeg_${idx}`;
      seg.position.set(ox, 0, 0);
      speechGroup.add(seg);
      speechBars.push(seg);
    });
  } else {
    const speechBarGeo = trackGeo(new RoundedBoxGeometry(0.065, 0.06, 0.04, 2, 0.02));
    [-0.22, -0.11, 0, 0.11, 0.22].forEach((ox, idx) => {
      const bar = new THREE.Mesh(speechBarGeo, secondaryMat);
      bar.name = `SpeechBar_${idx}`;
      bar.position.set(ox, 0, 0);
      speechGroup.add(bar);
      speechBars.push(bar);
    });
  }

  // 5. 7 Top Accessories
  const accessoryGroup = new THREE.Group();
  accessoryGroup.name = 'AccessoryGroup';
  headGroup.add(accessoryGroup);

  let haloRing: THREE.Mesh | null = null;
  let floatingPointer: THREE.Mesh | null = null;
  let beaconMesh: THREE.Mesh | null = null;

  if (spec.accessory === 'antenna-pin') {
    const stemGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.042, 0.56, 16));
    const stem = new THREE.Mesh(stemGeo, secondaryMat);
    stem.name = 'AntennaStem';
    stem.position.set(0.46, bodyTopY + 0.2, -0.05);
    stem.rotation.z = -0.14;
    accessoryGroup.add(stem);

    const tipGeo = trackGeo(new THREE.SphereGeometry(0.11, 20, 16));
    beaconMesh = new THREE.Mesh(tipGeo, accentMat);
    beaconMesh.name = 'AntennaBeacon';
    beaconMesh.position.set(0.5, bodyTopY + 0.5, -0.05);
    accessoryGroup.add(beaconMesh);
  } else if (spec.accessory === 'twin-antennas') {
    const stemGeo = trackGeo(new THREE.CylinderGeometry(0.028, 0.038, 0.52, 16));
    const tipGeo = trackGeo(new THREE.SphereGeometry(0.085, 16, 14));
    [-1, 1].forEach((dir, idx) => {
      const stem = new THREE.Mesh(stemGeo, secondaryMat);
      stem.name = `TwinStem_${idx}`;
      stem.position.set(dir * 0.54, bodyTopY + 0.16, -0.04);
      stem.rotation.z = -dir * 0.24;
      accessoryGroup.add(stem);

      const tip = new THREE.Mesh(tipGeo, accentMat);
      tip.name = `TwinTip_${idx}`;
      tip.position.set(dir * 0.62, bodyTopY + 0.42, -0.04);
      accessoryGroup.add(tip);
    });
  } else if (spec.accessory === 'cat-ears') {
    const earOuterGeo = trackGeo(new THREE.ConeGeometry(0.28, 0.54, 4));
    const earInnerGeo = trackGeo(new THREE.ConeGeometry(0.15, 0.34, 4));
    [-1, 1].forEach((dir, idx) => {
      const ear = new THREE.Mesh(earOuterGeo, frameMat);
      ear.name = `MechaEar_${idx}`;
      ear.position.set(dir * 0.58, bodyTopY + 0.16, 0.02);
      ear.rotation.y = Math.PI / 4;
      ear.rotation.z = -dir * 0.2;
      accessoryGroup.add(ear);

      const inner = new THREE.Mesh(earInnerGeo, accentMat);
      inner.name = `MechaEarInner_${idx}`;
      inner.position.set(dir * 0.58, bodyTopY + 0.14, 0.12);
      inner.rotation.y = Math.PI / 4;
      inner.rotation.z = -dir * 0.2;
      accessoryGroup.add(inner);
    });
  } else if (spec.accessory === 'halo-ring') {
    const haloGeo = trackGeo(new THREE.TorusGeometry(1.52, 0.042, 16, 64));
    haloRing = new THREE.Mesh(haloGeo, accentMat);
    haloRing.name = 'HaloRing';
    haloRing.rotation.x = Math.PI * 0.42;
    haloRing.rotation.y = -0.22;
    accessoryGroup.add(haloRing);
  } else if (spec.accessory === 'visor-hood') {
    const hoodGeo = trackGeo(new RoundedBoxGeometry(visorW + 0.22, 0.16, 0.42, 3, 0.06));
    const hood = new THREE.Mesh(hoodGeo, frameMat);
    hood.name = 'VisorHood';
    hood.position.set(0, 0.12 + visorH * 0.54, visorZ + 0.16);
    hood.rotation.x = 0.24;
    accessoryGroup.add(hood);
  } else if (spec.accessory === 'floating-pointer') {
    const ptrGeo = trackGeo(new THREE.ConeGeometry(0.16, 0.36, 4));
    floatingPointer = new THREE.Mesh(ptrGeo, accentMat);
    floatingPointer.name = 'FloatingPointer';
    floatingPointer.position.set(bodyHalfW + 0.38, -0.1, 0.36);
    floatingPointer.rotation.z = -Math.PI / 2;
    accessoryGroup.add(floatingPointer);
  }

  // 6. 4 Combinable Side Addons
  const sideAddon = spec.sideAddon ?? 'none';
  if (sideAddon === 'studio-headphones') {
    const bandGeo = trackGeo(new THREE.TorusGeometry(bodyHalfW + 0.18, 0.065, 16, 48, Math.PI));
    const band = new THREE.Mesh(bandGeo, frameMat);
    band.name = 'HeadphoneBand';
    band.position.set(0, 0.14, 0);
    headGroup.add(band);

    const cupGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 28));
    const ringGeo = trackGeo(new THREE.TorusGeometry(0.24, 0.03, 12, 28));
    [-1, 1].forEach((dir, idx) => {
      const cup = new THREE.Mesh(cupGeo, frameMat);
      cup.name = `HeadphoneCup_${idx}`;
      cup.rotation.z = Math.PI / 2;
      cup.position.set(dir * (bodyHalfW + 0.14), 0.12, 0);
      headGroup.add(cup);

      const led = new THREE.Mesh(ringGeo, accentMat);
      led.name = `HeadphoneLed_${idx}`;
      led.rotation.y = Math.PI / 2;
      led.position.set(dir * (bodyHalfW + 0.24), 0.12, 0);
      headGroup.add(led);
    });
  } else if (sideAddon === 'side-fins') {
    const finGeo = trackGeo(new RoundedBoxGeometry(0.14, 0.68, 0.44, 2, 0.03));
    [-1, 1].forEach((dir, idx) => {
      const fin = new THREE.Mesh(finGeo, accentMat);
      fin.name = `SideFin_${idx}`;
      fin.position.set(dir * (bodyHalfW + 0.12), 0.06, -0.05);
      fin.rotation.z = dir * -0.18;
      headGroup.add(fin);
    });
  } else if (sideAddon === 'rotary-knobs') {
    const knobGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 24));
    [-1, 1].forEach((dir, idx) => {
      const knob = new THREE.Mesh(knobGeo, secondaryMat);
      knob.name = `RotaryKnob_${idx}`;
      knob.rotation.z = Math.PI / 2;
      knob.position.set(dir * (bodyHalfW + 0.08), -0.12, 0.12);
      headGroup.add(knob);
    });
  }

  return {
    root,
    hoverPivot,
    headGroup,
    eyeLeft,
    eyeRight,
    irisRing,
    irisCore,
    slitMarker,
    waveformEyeBars,
    speechBars,
    mouthCoreMesh,
    accessoryGroup,
    haloRing,
    floatingPointer,
    beaconMesh,
    accentMat,
    secondaryMat,
    geometries,
    materials,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

export function applyPoseToOpticRig(
  rig: BuiltOpticRig,
  pose: OpticPoseState,
  spec: OpticAvatarSpec,
): void {
  const glowScale = Math.max(0.3, Math.min(2.0, spec.glowIntensity ?? 1));
  rig.hoverPivot.position.y = pose.hoverY;
  rig.hoverPivot.scale.setScalar(pose.entryScale);

  rig.headGroup.rotation.y = pose.headYaw;
  rig.headGroup.rotation.x = pose.headPitch;
  rig.headGroup.rotation.z = pose.headRoll;

  rig.accentMat.emissiveIntensity = (0.9 + pose.visorGlow * 0.65) * glowScale;
  rig.secondaryMat.emissiveIntensity = (0.45 + pose.mouthOpen * 0.85) * glowScale;

  const lookOffsetX = pose.eyeLookX * 0.09;
  const lookOffsetY = pose.eyeLookY * 0.06;

  if (rig.eyeLeft && rig.eyeRight) {
    const isTech = (spec.universe ?? 'tech') === 'tech' && !spec.customSprites?.idleUrl;
    rig.eyeLeft.scale.y = pose.leftEyeScaleY;
    rig.eyeRight.scale.y = pose.rightEyeScaleY;
    if (isTech) {
      const gap = 0.3 * Math.max(0.75, Math.min(1.3, spec.eyeSpacing));
      rig.eyeLeft.position.x = -gap + lookOffsetX;
      rig.eyeRight.position.x = gap + lookOffsetX;
      const baseY = spec.eyeStyle === 'happy-arcs' ? 0.13 : 0.18;
      rig.eyeLeft.position.y = baseY + lookOffsetY;
      rig.eyeRight.position.y = baseY + lookOffsetY;
    } else {
      if (rig.eyeLeft.userData.baseX === undefined) {
        rig.eyeLeft.userData.baseX = rig.eyeLeft.position.x;
        rig.eyeLeft.userData.baseY = rig.eyeLeft.position.y;
      }
      if (rig.eyeRight.userData.baseX === undefined) {
        rig.eyeRight.userData.baseX = rig.eyeRight.position.x;
        rig.eyeRight.userData.baseY = rig.eyeRight.position.y;
      }
      rig.eyeLeft.position.x = (rig.eyeLeft.userData.baseX as number) + lookOffsetX * 0.45;
      rig.eyeLeft.position.y = (rig.eyeLeft.userData.baseY as number) + lookOffsetY * 0.45;
      rig.eyeRight.position.x = (rig.eyeRight.userData.baseX as number) + lookOffsetX * 0.45;
      rig.eyeRight.position.y = (rig.eyeRight.userData.baseY as number) + lookOffsetY * 0.45;
    }
  }

  if (rig.irisRing && rig.irisCore) {
    const irisScale = 0.78 + ((pose.leftEyeScaleY + pose.rightEyeScaleY) / 2) * 0.26;
    rig.irisRing.scale.setScalar(irisScale);
    rig.irisCore.position.x = lookOffsetX;
    rig.irisCore.position.y = 0.18 + lookOffsetY;
    if (spec.eyeStyle !== 'crosshair-hud') {
      rig.irisCore.scale.setScalar(0.85 + pose.mouthOpen * 0.35);
    }
  }

  if (rig.slitMarker) {
    rig.slitMarker.position.x = pose.eyeLookX * 0.26;
    rig.slitMarker.scale.y = Math.max(0.2, (pose.leftEyeScaleY + pose.rightEyeScaleY) / 2);
  }

  rig.waveformEyeBars.forEach((bar, idx) => {
    const base = 0.65 + ((idx * 37) % 10) * 0.05;
    const pulse = 0.35 * Math.sin(pose.accessorySpin * 4.5 + idx * 1.1);
    bar.scale.y = Math.max(0.14, (base + pulse + pose.mouthOpen * 0.9) * pose.blinkScaleY);
  });

  const mouthStyle = spec.mouthStyle ?? 'equalizer-bars';
  if (rig.mouthCoreMesh) {
    const sY = pose.mouthOpen > 0.02 ? 0.8 + pose.mouthOpen * 2.4 : 0.45;
    const sX = 0.85 + pose.mouthOpen * 0.45;
    rig.mouthCoreMesh.scale.set(sX, sY, 1);
  } else {
    const weights = [0.45, 0.85, 1.15, 0.85, 0.45, 0.8, 0.45];
    rig.speechBars.forEach((bar, idx) => {
      if (mouthStyle === 'oscilloscope-line') {
        bar.position.y =
          pose.mouthOpen > 0.02
            ? Math.sin(pose.accessorySpin * 14 + idx * 1.1) * 0.09 * pose.mouthOpen
            : 0;
        bar.scale.y = 0.8 + pose.mouthOpen * 0.6;
      } else if (mouthStyle === 'speaker-dots') {
        const s = pose.mouthOpen > 0.02 ? 0.75 + pose.mouthOpen * 1.1 * (weights[idx] ?? 0.8) : 0.6;
        bar.scale.set(s, s, 1);
      } else {
        const h =
          pose.mouthOpen > 0.02
            ? 0.65 +
              pose.mouthOpen *
                3.2 *
                (weights[idx] ?? 0.7) *
                (0.85 + 0.15 * Math.sin(pose.accessorySpin * 8 + idx))
            : 0.45;
        bar.scale.y = h;
      }
    });
  }

  if (rig.haloRing) {
    rig.haloRing.rotation.z = pose.accessorySpin * 0.5;
  }
  if (rig.floatingPointer) {
    rig.floatingPointer.position.y = -0.1 + Math.sin(pose.accessorySpin * 2.4) * 0.14;
  }
}

export async function exportOpticSpecToGlb(spec: OpticAvatarSpec): Promise<ArrayBuffer> {
  const rig = buildOpticThreeRig(spec);
  try {
    const exporter = new GLTFExporter();
    const res = await exporter.parseAsync(rig.root, { binary: true });
    if (res instanceof ArrayBuffer) {
      return res;
    }
    const jsonBytes = new TextEncoder().encode(JSON.stringify(res));
    return jsonBytes.buffer.slice(jsonBytes.byteOffset, jsonBytes.byteOffset + jsonBytes.byteLength);
  } finally {
    rig.dispose();
  }
}

export async function loadCustomGlbNormalized(url: string): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const container = new THREE.Group();
  container.name = 'CustomGlbRoot';

  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(0.001, size.x, size.y, size.z);
  const scale = 2.05 / maxDim;
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  container.add(model);
  return container;
}
