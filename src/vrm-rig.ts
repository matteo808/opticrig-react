import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { OpticPoseState } from './rig-math.ts';
import type { OpticExpression } from './types.ts';

export interface LoadedCustomAvatar3D {
  group: THREE.Group;
  isVrm: boolean;
  applyPose: (pose: OpticPoseState, expression: OpticExpression) => void;
  dispose: () => void;
}

interface MorphBinding {
  mesh: THREE.Mesh;
  aa: number[];
  oh: number[];
  blink: number[];
  happy: number[];
  angry: number[];
  surprised: number[];
}

interface BoneBinding {
  obj: THREE.Object3D;
  restRotX: number;
  restRotY: number;
  restRotZ: number;
}

function collectMorphBindings(root: THREE.Object3D): MorphBinding[] {
  const bindings: MorphBinding[] = [];

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
    const dict = mesh.morphTargetDictionary;
    const aa: number[] = [];
    const oh: number[] = [];
    const blink: number[] = [];
    const happy: number[] = [];
    const angry: number[] = [];
    const surprised: number[] = [];

    for (const [rawName, idx] of Object.entries(dict)) {
      const n = rawName.toLowerCase();
      if (n === 'aa' || n === 'a' || n.includes('mth_a') || n.includes('mouthopen') || n === 'jawopen') {
        aa.push(idx);
      } else if (n === 'oh' || n === 'o' || n.includes('mth_o') || n === 'ou') {
        oh.push(idx);
      } else if (n === 'blink' || n.includes('eye_close') || n === 'blink_l' || n === 'blink_r') {
        blink.push(idx);
      } else if (n === 'happy' || n === 'joy' || n.includes('all_joy') || n === 'fun') {
        happy.push(idx);
      } else if (n === 'angry' || n.includes('all_angry')) {
        angry.push(idx);
      } else if (n === 'surprised' || n.includes('all_surprised')) {
        surprised.push(idx);
      }
    }

    if (aa.length + oh.length + blink.length + happy.length + angry.length + surprised.length > 0) {
      bindings.push({ mesh, aa, oh, blink, happy, angry, surprised });
    }
  });

  return bindings;
}

function findBoneByHumanName(
  root: THREE.Object3D,
  names: string[],
): THREE.Object3D | null {
  const lowerTargets = names.map((s) => s.toLowerCase());
  let found: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (found) return;
    const n = (obj.name || '').toLowerCase();
    if (lowerTargets.some((t) => n === t || n.endsWith(`_${t}`) || n.includes(t))) {
      found = obj;
    }
  });
  return found;
}

function collectSecondaryHairBones(root: THREE.Object3D): BoneBinding[] {
  const hairs: BoneBinding[] = [];
  root.traverse((obj) => {
    const n = (obj.name || '').toLowerCase();
    if (n.includes('j_sec_hair') || n.includes('hair_')) {
      hairs.push({
        obj,
        restRotX: obj.rotation.x,
        restRotY: obj.rotation.y,
        restRotZ: obj.rotation.z,
      });
    }
  });
  return hairs;
}

export async function loadCustomVrmOrGlb(
  url: string,
  forceVrmHint = false,
): Promise<LoadedCustomAvatar3D> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);

  const parserJson = (
    gltf.parser as unknown as {
      json?: {
        extensions?: {
          VRM?: Record<string, unknown>;
          VRMC_vrm?: Record<string, unknown>;
        };
      };
    }
  )?.json;

  const isVrm0 = Boolean(parserJson?.extensions?.VRM);
  const isVrm1 = Boolean(parserJson?.extensions?.VRMC_vrm);
  const morphBindings = collectMorphBindings(gltf.scene);
  const isVrm = forceVrmHint || isVrm0 || isVrm1 || morphBindings.length > 0;

  const model = gltf.scene;

  // VRM 0.x characters typically face -Z; rotate to face +Z toward camera
  if (isVrm0 && !isVrm1) {
    model.rotation.y = Math.PI;
  }

  // Relax T-pose upper arms on VRoid/VRM skeletons when present
  const leftUpperArm = findBoneByHumanName(model, ['j_bip_l_upperarm', 'leftupperarm', 'upperarm_l']);
  const rightUpperArm = findBoneByHumanName(model, ['j_bip_r_upperarm', 'rightupperarm', 'upperarm_r']);
  if (leftUpperArm) {
    leftUpperArm.rotation.z = -1.12;
  }
  if (rightUpperArm) {
    rightUpperArm.rotation.z = 1.12;
  }

  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const container = new THREE.Group();
  container.name = isVrm ? 'CustomVrmRoot' : 'CustomGlbRoot';

  const headBone = findBoneByHumanName(model, ['j_bip_c_head', 'head']);
  const neckBone = findBoneByHumanName(model, ['j_bip_c_neck', 'neck']);

  // If tall humanoid / full-body VRM, auto-frame bust / head portrait so it fills center stage cleanly
  const isFullBodyHumanoid = isVrm && size.y > size.x * 1.25;
  if (isFullBodyHumanoid) {
    const scale = 2.9 / Math.max(0.001, size.y);
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    let focusY = box.min.y * scale + size.y * scale * 0.82;
    let focusX = center.x * scale;
    let focusZ = center.z * scale;
    if (headBone) {
      const wp = new THREE.Vector3();
      headBone.getWorldPosition(wp);
      focusX = wp.x;
      focusY = wp.y - 0.16;
      focusZ = wp.z;
    }
    model.position.set(-focusX, -focusY, -focusZ);
  } else {
    const maxDim = Math.max(0.001, size.x, size.y, size.z);
    const scale = 2.1 / maxDim;
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  }

  container.add(model);

  const headBinding: BoneBinding | null = headBone
    ? {
        obj: headBone,
        restRotX: headBone.rotation.x,
        restRotY: headBone.rotation.y,
        restRotZ: headBone.rotation.z,
      }
    : null;
  const neckBinding: BoneBinding | null = neckBone
    ? {
        obj: neckBone,
        restRotX: neckBone.rotation.x,
        restRotY: neckBone.rotation.y,
        restRotZ: neckBone.rotation.z,
      }
    : null;
  const hairBones = collectSecondaryHairBones(model);

  const applyPose = (pose: OpticPoseState, expression: OpticExpression) => {
    container.position.y = pose.hoverY * 0.45;
    container.rotation.set(pose.headPitch * 0.25, pose.headYaw * 0.45, pose.headRoll * 0.25);
    container.scale.setScalar(pose.entryScale);

    if (headBinding) {
      headBinding.obj.rotation.x = headBinding.restRotX + pose.headPitch * 0.65;
      headBinding.obj.rotation.y = headBinding.restRotY + pose.headYaw * 0.65;
      headBinding.obj.rotation.z = headBinding.restRotZ + pose.headRoll * 0.6;
    }
    if (neckBinding) {
      neckBinding.obj.rotation.y = neckBinding.restRotY + pose.headYaw * 0.25;
    }
    hairBones.forEach((hb, i) => {
      hb.obj.rotation.z = hb.restRotZ + Math.sin(pose.accessorySpin * 2.4 + i) * 0.04;
    });

    const blinkVal = Math.max(0, Math.min(1, 1 - pose.blinkScaleY));
    const aaVal = Math.max(0, Math.min(1, pose.mouthOpen * 1.05));
    const ohVal = Math.max(0, Math.min(1, pose.mouthOpen * 0.35 * (0.5 + 0.5 * Math.sin(pose.accessorySpin * 9))));
    const happyVal = expression === 'approve' ? 0.85 : expression === 'insight' ? 0.4 : 0;
    const angryVal = expression === 'warning' ? 0.85 : 0;
    const surprisedVal = expression === 'insight' ? 0.75 : expression === 'skeptical' ? 0.45 : 0;

    for (const b of morphBindings) {
      const inf = b.mesh.morphTargetInfluences;
      if (!inf) continue;
      for (const idx of b.aa) inf[idx] = aaVal;
      for (const idx of b.oh) inf[idx] = ohVal;
      for (const idx of b.blink) inf[idx] = blinkVal;
      for (const idx of b.happy) inf[idx] = happyVal;
      for (const idx of b.angry) inf[idx] = angryVal;
      for (const idx of b.surprised) inf[idx] = surprisedVal;
    }
  };

  const dispose = () => {
    model.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
  };

  return { group: container, isVrm, applyPose, dispose };
}
