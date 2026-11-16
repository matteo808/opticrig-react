import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { OpticPoseState } from './rig-math.ts';
import type { OpticAvatarSpec, OpticMaterialFinish } from './types.ts';

export interface BuiltOpticRig {
  root: THREE.Group;
  hoverPivot: THREE.Group;
  headGroup: THREE.Group;
  eyeLeft: THREE.Mesh | null;
  eyeRight: THREE.Mesh | null;
  irisRing: THREE.Mesh | null;
  irisCore: THREE.Mesh | null;
  slitMarker: THREE.Mesh | null;
  waveformEyeBars: THREE.Mesh[];
  speechBars: THREE.Mesh[];
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
      color: new THREE.Color(spec.bodyColor).multiplyScalar(0.78),
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

  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.accentColor),
      emissive: new THREE.Color(spec.accentColor),
      emissiveIntensity: 1.25,
      roughness: 0.25,
      metalness: 0.1,
    }),
  );

  const secondaryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.secondaryColor),
      emissive: new THREE.Color(spec.secondaryColor),
      emissiveIntensity: 0.65,
      roughness: 0.3,
      metalness: 0.25,
    }),
  );

  let visorZ = 0.64;
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
  }

  const vScale = Math.max(0.75, Math.min(1.25, spec.visorScale));
  const visorW = 1.46 * vScale;
  const visorH = 0.92 * vScale;

  const visorFrameGeo = trackGeo(
    new RoundedBoxGeometry(visorW + 0.1, visorH + 0.1, 0.12, 3, 0.12),
  );
  const visorFrame = new THREE.Mesh(visorFrameGeo, frameMat);
  visorFrame.name = 'VisorFrame';
  visorFrame.position.set(0, 0.14, visorZ);
  headGroup.add(visorFrame);

  const visorGlassGeo = trackGeo(new RoundedBoxGeometry(visorW, visorH, 0.08, 3, 0.1));
  const visorGlass = new THREE.Mesh(visorGlassGeo, visorMat);
  visorGlass.name = 'VisorGlass';
  visorGlass.position.set(0, 0.14, visorZ + 0.045);
  headGroup.add(visorGlass);

  const eyeZ = visorZ + 0.105;
  const eyeY = 0.2;
  const eyeGap = 0.3 * Math.max(0.75, Math.min(1.3, spec.eyeSpacing));

  let eyeLeft: THREE.Mesh | null = null;
  let eyeRight: THREE.Mesh | null = null;
  let irisRing: THREE.Mesh | null = null;
  let irisCore: THREE.Mesh | null = null;
  let slitMarker: THREE.Mesh | null = null;
  const waveformEyeBars: THREE.Mesh[] = [];

  if (spec.eyeStyle === 'aperture-iris') {
    const ringGeo = trackGeo(new THREE.TorusGeometry(0.24, 0.045, 16, 36));
    irisRing = new THREE.Mesh(ringGeo, accentMat);
    irisRing.name = 'IrisRing';
    irisRing.position.set(0, eyeY, eyeZ);
    headGroup.add(irisRing);

    const coreGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 24));
    irisCore = new THREE.Mesh(coreGeo, secondaryMat);
    irisCore.name = 'IrisCore';
    irisCore.rotation.x = Math.PI / 2;
    irisCore.position.set(0, eyeY, eyeZ + 0.01);
    headGroup.add(irisCore);
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
  } else {
    const eyeGeo = trackGeo(new RoundedBoxGeometry(0.22, 0.34, 0.06, 3, 0.07));
    eyeLeft = new THREE.Mesh(eyeGeo, accentMat);
    eyeLeft.name = 'EyeLeft';
    eyeLeft.position.set(-eyeGap, eyeY, eyeZ);
    headGroup.add(eyeLeft);

    eyeRight = new THREE.Mesh(eyeGeo, accentMat);
    eyeRight.name = 'EyeRight';
    eyeRight.position.set(eyeGap, eyeY, eyeZ);
    headGroup.add(eyeRight);
  }

  const speechGroup = new THREE.Group();
  speechGroup.name = 'SpeechWaveformBars';
  speechGroup.position.set(0, 0.14 - visorH * 0.31, eyeZ);
  headGroup.add(speechGroup);

  const speechBars: THREE.Mesh[] = [];
  const speechBarGeo = trackGeo(new RoundedBoxGeometry(0.065, 0.06, 0.04, 2, 0.02));
  [-0.22, -0.11, 0, 0.11, 0.22].forEach((ox, idx) => {
    const bar = new THREE.Mesh(speechBarGeo, secondaryMat);
    bar.name = `SpeechBar_${idx}`;
    bar.position.set(ox, 0, 0);
    speechGroup.add(bar);
    speechBars.push(bar);
  });

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
    stem.position.set(0.46, 1.24, -0.05);
    stem.rotation.z = -0.14;
    accessoryGroup.add(stem);

    const tipGeo = trackGeo(new THREE.SphereGeometry(0.11, 20, 16));
    beaconMesh = new THREE.Mesh(tipGeo, accentMat);
    beaconMesh.name = 'AntennaBeacon';
    beaconMesh.position.set(0.5, 1.54, -0.05);
    accessoryGroup.add(beaconMesh);
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
    hood.position.set(0, 0.14 + visorH * 0.54, visorZ + 0.16);
    hood.rotation.x = 0.24;
    accessoryGroup.add(hood);
  } else if (spec.accessory === 'floating-pointer') {
    const ptrGeo = trackGeo(new THREE.ConeGeometry(0.16, 0.36, 4));
    floatingPointer = new THREE.Mesh(ptrGeo, accentMat);
    floatingPointer.name = 'FloatingPointer';
    floatingPointer.position.set(1.36, -0.1, 0.36);
    floatingPointer.rotation.z = -Math.PI / 2;
    accessoryGroup.add(floatingPointer);
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
  rig.hoverPivot.position.y = pose.hoverY;
  rig.hoverPivot.scale.setScalar(pose.entryScale);

  rig.headGroup.rotation.y = pose.headYaw;
  rig.headGroup.rotation.x = pose.headPitch;
  rig.headGroup.rotation.z = pose.headRoll;

  rig.accentMat.emissiveIntensity = 0.9 + pose.visorGlow * 0.65;
  rig.secondaryMat.emissiveIntensity = 0.45 + pose.mouthOpen * 0.85;

  const lookOffsetX = pose.eyeLookX * 0.09;
  const lookOffsetY = pose.eyeLookY * 0.06;

  if (rig.eyeLeft && rig.eyeRight) {
    const gap = 0.3 * Math.max(0.75, Math.min(1.3, spec.eyeSpacing));
    rig.eyeLeft.scale.y = pose.leftEyeScaleY;
    rig.eyeRight.scale.y = pose.rightEyeScaleY;
    rig.eyeLeft.position.x = -gap + lookOffsetX;
    rig.eyeRight.position.x = gap + lookOffsetX;
    rig.eyeLeft.position.y = 0.2 + lookOffsetY;
    rig.eyeRight.position.y = 0.2 + lookOffsetY;
  }

  if (rig.irisRing && rig.irisCore) {
    const irisScale = 0.78 + ((pose.leftEyeScaleY + pose.rightEyeScaleY) / 2) * 0.26;
    rig.irisRing.scale.setScalar(irisScale);
    rig.irisCore.position.x = lookOffsetX;
    rig.irisCore.position.y = 0.2 + lookOffsetY;
    rig.irisCore.scale.setScalar(0.85 + pose.mouthOpen * 0.35);
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

  const weights = [0.45, 0.85, 1.15, 0.85, 0.45];
  rig.speechBars.forEach((bar, idx) => {
    const h =
      pose.mouthOpen > 0.02
        ? 0.65 +
          pose.mouthOpen *
            3.2 *
            (weights[idx] ?? 0.7) *
            (0.85 + 0.15 * Math.sin(pose.accessorySpin * 8 + idx))
        : 0.45;
    bar.scale.y = h;
  });

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
