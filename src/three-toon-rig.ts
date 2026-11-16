import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { BuiltOpticRig } from './three-rig.ts';
import type { OpticAvatarSpec } from './types.ts';

function createToonGradientTexture(): THREE.DataTexture {
  const colors = new Uint8Array([
    108, 108, 120, 255,
    188, 188, 198, 255,
    255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(colors, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function buildStylizedThreeRig(spec: OpticAvatarSpec): BuiltOpticRig {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const gradientMap = createToonGradientTexture();
  textures.push(gradientMap);

  const toonMat = (hex: string, emissiveHex?: string, emissiveIntensity = 0) =>
    trackMat(
      new THREE.MeshToonMaterial({
        color: new THREE.Color(hex),
        gradientMap,
        emissive: emissiveHex ? new THREE.Color(emissiveHex) : new THREE.Color('#000000'),
        emissiveIntensity,
      }),
    );

  const outlineMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#0F172A'),
      side: THREE.BackSide,
    }),
  );

  const addOutlinedMesh = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    rot?: [number, number, number],
    scale?: [number, number, number],
    outlineScale = 1.055,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    parent.add(mesh);

    const outline = new THREE.Mesh(geo, outlineMat);
    outline.position.set(pos[0], pos[1], pos[2]);
    if (rot) outline.rotation.set(rot[0], rot[1], rot[2]);
    const sx = (scale?.[0] ?? 1) * outlineScale;
    const sy = (scale?.[1] ?? 1) * outlineScale;
    const sz = (scale?.[2] ?? 1) * outlineScale;
    outline.scale.set(sx, sy, sz);
    parent.add(outline);

    return mesh;
  };

  const root = new THREE.Group();
  root.name = 'StylizedOpticRigRoot';

  const hoverPivot = new THREE.Group();
  hoverPivot.name = 'HoverPivot';
  root.add(hoverPivot);

  const headGroup = new THREE.Group();
  headGroup.name = 'HeadGroup';
  headGroup.scale.set(1, spec.bodyStretchY ?? 1, 1);
  hoverPivot.add(headGroup);

  const glowScale = Math.max(0.3, Math.min(2.0, spec.glowIntensity ?? 1));
  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.accentColor || '#38BDF8'),
      emissive: new THREE.Color(spec.accentColor || '#38BDF8'),
      emissiveIntensity: 0.9 * glowScale,
      roughness: 0.25,
      metalness: 0.15,
    }),
  );
  const secondaryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.secondaryColor || '#FDE68A'),
      emissive: new THREE.Color(spec.secondaryColor || '#FDE68A'),
      emissiveIntensity: 0.55 * glowScale,
      roughness: 0.3,
      metalness: 0.15,
    }),
  );

  const accessoryGroup = new THREE.Group();
  accessoryGroup.name = 'AccessoryGroup';
  headGroup.add(accessoryGroup);

  let eyeLeft: THREE.Object3D | null = null;
  let eyeRight: THREE.Object3D | null = null;
  let mouthCoreMesh: THREE.Mesh | null = null;
  let haloRing: THREE.Mesh | null = null;
  let floatingPointer: THREE.Mesh | null = null;
  let beaconMesh: THREE.Mesh | null = null;
  const speechBars: THREE.Mesh[] = [];

  const universe = spec.universe ?? 'anime';

  if (universe === 'custom-art' && spec.customSprites?.idleUrl) {
    // 3D Holographic Acrylic Standee for Custom Art / AI Sprite
    const texLoader = new THREE.TextureLoader();
    const idleTex = texLoader.load(spec.customSprites.idleUrl);
    idleTex.colorSpace = THREE.SRGBColorSpace;
    textures.push(idleTex);

    const standMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: idleTex,
        transparent: true,
        side: THREE.DoubleSide,
        alphaTest: 0.12,
      }),
    );
    const cardGeo = trackGeo(new THREE.PlaneGeometry(2.1, 2.1));
    const cardMesh = new THREE.Mesh(cardGeo, standMat);
    cardMesh.name = 'CustomSpriteCard3D';
    cardMesh.position.set(0, 0.1, 0);
    headGroup.add(cardMesh);

    const frameGeo = trackGeo(new THREE.TorusGeometry(1.18, 0.032, 12, 48));
    haloRing = new THREE.Mesh(frameGeo, accentMat);
    haloRing.rotation.x = Math.PI * 0.48;
    haloRing.position.set(0, -0.95, 0);
    accessoryGroup.add(haloRing);
  } else if (universe === 'pixel') {
    // 3D Voxel Bust
    const skinMat = toonMat(spec.skinColor || '#FDE6D8');
    const hairMat = toonMat(spec.hairColor || spec.bodyColor || '#4F46E5');
    const suitMat = toonMat(spec.bodyColor || '#1E293B');
    const darkMat = toonMat('#0F172A');
    const eyeColMat = accentMat;

    const voxelHeadGeo = trackGeo(new THREE.BoxGeometry(1.38, 1.32, 1.24));
    addOutlinedMesh(headGroup, voxelHeadGeo, skinMat, [0, 0.16, 0]);

    const voxelHairTopGeo = trackGeo(new THREE.BoxGeometry(1.48, 0.42, 1.34));
    addOutlinedMesh(headGroup, voxelHairTopGeo, hairMat, [0, 0.72, -0.02]);

    const voxelTorsoGeo = trackGeo(new THREE.BoxGeometry(1.12, 0.78, 0.78));
    addOutlinedMesh(headGroup, voxelTorsoGeo, suitMat, [0, -0.82, 0]);

    // Voxel Eyes
    const vEyeGeo = trackGeo(new THREE.BoxGeometry(0.22, 0.28, 0.12));
    const eL = new THREE.Mesh(vEyeGeo, darkMat);
    eL.position.set(-0.3, 0.18, 0.62);
    headGroup.add(eL);
    eyeLeft = eL;

    const eR = new THREE.Mesh(vEyeGeo, darkMat);
    eR.position.set(0.3, 0.18, 0.62);
    headGroup.add(eR);
    eyeRight = eR;

    const vPupilGeo = trackGeo(new THREE.BoxGeometry(0.1, 0.1, 0.06));
    const pL = new THREE.Mesh(vPupilGeo, eyeColMat);
    pL.position.set(-0.04, 0.04, 0.06);
    eL.add(pL);
    const pR = new THREE.Mesh(vPupilGeo, eyeColMat);
    pR.position.set(-0.04, 0.04, 0.06);
    eR.add(pR);

    const vMouthGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.12, 0.12));
    mouthCoreMesh = new THREE.Mesh(vMouthGeo, toonMat('#881337'));
    mouthCoreMesh.position.set(0, -0.22, 0.62);
    headGroup.add(mouthCoreMesh);
  } else if (universe === 'animal') {
    // 3D Toon Cute Pet
    const species = spec.characterBase ?? 'neko-cat';
    const furColor = spec.bodyColor || '#FFF7ED';
    const furMat = toonMat(furColor);
    const darkFurMat = toonMat('#18181B');
    const innerPinkMat = toonMat('#FDA4AF');
    const eyeMat = toonMat('#0F172A');
    const whiteMat = trackMat(new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
    const mouthMat = toonMat('#881337');

    const headGeo = trackGeo(new THREE.SphereGeometry(0.95, 28, 24));
    addOutlinedMesh(headGroup, headGeo, furMat, [0, 0.15, 0], undefined, [1.14, 0.96, 1.0]);

    const bodyGeo = trackGeo(new THREE.SphereGeometry(0.64, 22, 18));
    addOutlinedMesh(headGroup, bodyGeo, furMat, [0, -0.82, -0.06], undefined, [1.05, 0.85, 0.9]);

    if (species === 'panda-bear') {
      const patchGeo = trackGeo(new THREE.SphereGeometry(0.24, 16, 16));
      [-1, 1].forEach((dir) => {
        const patch = new THREE.Mesh(patchGeo, darkFurMat);
        patch.position.set(dir * 0.34, 0.22, 0.78);
        patch.scale.set(1.1, 0.95, 0.38);
        headGroup.add(patch);
      });
    }

    // Species 3D Ears
    if (species === 'lop-bunny') {
      const earGeo = trackGeo(new THREE.CapsuleGeometry(0.18, 0.7, 8, 16));
      [-1, 1].forEach((dir) => {
        addOutlinedMesh(
          headGroup,
          earGeo,
          furMat,
          [dir * 0.98, 0.05, 0.06],
          [0, 0, dir * 0.28],
        );
      });
    } else if (species === 'panda-bear') {
      const earGeo = trackGeo(new THREE.SphereGeometry(0.28, 16, 16));
      [-1, 1].forEach((dir) => {
        addOutlinedMesh(headGroup, earGeo, darkFurMat, [dir * 0.72, 0.88, -0.05]);
      });
    } else if (species === 'cozy-frog') {
      const bumpGeo = trackGeo(new THREE.SphereGeometry(0.3, 16, 16));
      [-1, 1].forEach((dir) => {
        addOutlinedMesh(headGroup, bumpGeo, furMat, [dir * 0.45, 0.94, 0.2]);
      });
    } else {
      const earGeo = trackGeo(new THREE.ConeGeometry(0.34, 0.68, 16));
      const inGeo = trackGeo(new THREE.ConeGeometry(0.2, 0.44, 12));
      const earMat = species === 'shiba-inu' ? accentMat : furMat;
      [-1, 1].forEach((dir) => {
        addOutlinedMesh(
          headGroup,
          earGeo,
          earMat,
          [dir * 0.62, 0.94, 0.04],
          [0.12, 0, dir * -0.32],
        );
        const inn = new THREE.Mesh(inGeo, innerPinkMat);
        inn.position.set(dir * 0.62, 0.9, 0.14);
        inn.rotation.set(0.12, 0, dir * -0.32);
        headGroup.add(inn);
      });
    }

    // 3D Glossy Eyes
    const eyeY = species === 'cozy-frog' ? 0.92 : 0.22;
    const eyeZ = species === 'cozy-frog' ? 0.36 : 0.88;
    const eyeGap = species === 'cozy-frog' ? 0.45 : 0.34;
    const eyeBallGeo = trackGeo(new THREE.SphereGeometry(0.16, 16, 16));
    const hlGeo = trackGeo(new THREE.SphereGeometry(0.055, 12, 12));

    const makePetEye = (side: -1 | 1) => {
      const g = new THREE.Group();
      g.position.set(side * eyeGap, eyeY, eyeZ);
      const ball = new THREE.Mesh(eyeBallGeo, eyeMat);
      ball.scale.set(1, 1.15, 0.6);
      g.add(ball);
      const hl = new THREE.Mesh(hlGeo, whiteMat);
      hl.position.set(-0.05, 0.06, 0.11);
      g.add(hl);
      headGroup.add(g);
      return g;
    };
    eyeLeft = makePetEye(-1);
    eyeRight = makePetEye(1);

    // Blush discs
    const blushGeo = trackGeo(new THREE.SphereGeometry(0.14, 12, 12));
    const blushMat = toonMat('#FB7185');
    [-1, 1].forEach((dir) => {
      const bl = new THREE.Mesh(blushGeo, blushMat);
      bl.position.set(dir * 0.54, 0.02, 0.78);
      bl.scale.set(1.2, 0.7, 0.25);
      headGroup.add(bl);
    });

    // Cute Snout Nose + Mouth
    if (species !== 'cozy-frog') {
      const noseGeo = trackGeo(new THREE.SphereGeometry(0.08, 12, 12));
      const nose = new THREE.Mesh(noseGeo, toonMat('#FB7185'));
      nose.position.set(0, 0.04, 0.96);
      headGroup.add(nose);
    }
    const mouthGeo = trackGeo(new RoundedBoxGeometry(0.22, 0.09, 0.08, 2, 0.04));
    mouthCoreMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthCoreMesh.position.set(0, -0.14, 0.92);
    headGroup.add(mouthCoreMesh);
  } else {
    // 3D Chibi Toon Bust for Anime & Comic
    const skinMat = toonMat(spec.skinColor || '#FFE4D6');
    const hairMat = toonMat(spec.hairColor || '#1E293B');
    const outfitMat = toonMat(spec.bodyColor || '#1E293B');
    const darkEyeMat = toonMat('#0F172A');
    const whiteMat = trackMat(new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
    const mouthMat = toonMat('#881337');

    // Chibi Head
    const headGeo = trackGeo(new THREE.SphereGeometry(0.9, 28, 24));
    addOutlinedMesh(headGroup, headGeo, skinMat, [0, 0.22, 0], undefined, [1.06, 0.98, 0.96]);

    // Chibi Torso Bust
    const torsoGeo = trackGeo(new RoundedBoxGeometry(1.18, 0.88, 0.72, 4, 0.26));
    addOutlinedMesh(headGroup, torsoGeo, outfitMat, [0, -0.92, -0.05]);

    // Back / Top Hair Cap
    const hairStyle = spec.hairStyle ?? 'messy-layers';
    if (hairStyle !== 'none') {
      const capGeo = trackGeo(new THREE.SphereGeometry(0.96, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.62));
      addOutlinedMesh(headGroup, capGeo, hairMat, [0, 0.3, -0.06], [-0.25, 0, 0]);

      if (hairStyle === 'twin-tails') {
        const tailGeo = trackGeo(new THREE.ConeGeometry(0.28, 1.25, 16));
        [-1, 1].forEach((dir) => {
          addOutlinedMesh(
            headGroup,
            tailGeo,
            hairMat,
            [dir * 1.12, -0.06, -0.14],
            [0.12, 0, dir * -2.65],
          );
        });
      } else if (hairStyle === 'cozy-bun') {
        const bunGeo = trackGeo(new THREE.SphereGeometry(0.32, 16, 16));
        [-1, 1].forEach((dir) => {
          addOutlinedMesh(headGroup, bunGeo, hairMat, [dir * 0.74, 1.02, -0.1]);
        });
      }
    }

    // 3D Chibi Eyes with Iris Accent & White Catchlights
    const eyeGap = 0.33 * spec.eyeSpacing;
    const baseEyeGeo = trackGeo(new THREE.SphereGeometry(0.16, 18, 16));
    const irisGeo = trackGeo(new THREE.SphereGeometry(0.11, 14, 14));
    const hlGeo = trackGeo(new THREE.SphereGeometry(0.05, 10, 10));

    const makeChibiEye = (side: -1 | 1) => {
      const g = new THREE.Group();
      g.position.set(side * eyeGap, 0.16, 0.83);
      const scl = new THREE.Mesh(baseEyeGeo, darkEyeMat);
      scl.scale.set(1.05, 1.25, 0.45);
      g.add(scl);
      const ir = new THREE.Mesh(irisGeo, accentMat);
      ir.position.set(0, -0.02, 0.045);
      ir.scale.set(1, 1.2, 0.35);
      g.add(ir);
      const hl = new THREE.Mesh(hlGeo, whiteMat);
      hl.position.set(-0.05, 0.07, 0.085);
      g.add(hl);
      headGroup.add(g);
      return g;
    };
    eyeLeft = makeChibiEye(-1);
    eyeRight = makeChibiEye(1);

    // Blush + Mouth
    const blushGeo = trackGeo(new THREE.SphereGeometry(0.12, 12, 12));
    const blushMat = toonMat('#FB7185');
    [-1, 1].forEach((dir) => {
      const bl = new THREE.Mesh(blushGeo, blushMat);
      bl.position.set(dir * 0.52, -0.05, 0.76);
      bl.scale.set(1.25, 0.65, 0.25);
      headGroup.add(bl);
    });

    const mouthGeo = trackGeo(new RoundedBoxGeometry(0.24, 0.1, 0.08, 2, 0.04));
    mouthCoreMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthCoreMesh.position.set(0, -0.22, 0.85);
    headGroup.add(mouthCoreMesh);
  }

  // Universal 3D Top Accessories for Stylized Chibi / Pet
  if (spec.accessory === 'neko-ears' || spec.accessory === 'cat-ears' || spec.accessory === 'fox-ears') {
    const earOuterGeo = trackGeo(new THREE.ConeGeometry(0.26, 0.52, 4));
    const earMat = toonMat(spec.hairColor || spec.bodyColor || '#1E293B');
    [-1, 1].forEach((dir) => {
      addOutlinedMesh(
        accessoryGroup,
        earOuterGeo,
        earMat,
        [dir * 0.6, 1.12, 0.02],
        [0, Math.PI / 4, -dir * 0.24],
      );
    });
  } else if (spec.accessory === 'halo-ring' || spec.accessory === 'angel-halo') {
    const haloGeo = trackGeo(new THREE.TorusGeometry(0.75, 0.045, 14, 48));
    haloRing = new THREE.Mesh(haloGeo, secondaryMat);
    haloRing.rotation.x = Math.PI * 0.48;
    haloRing.position.set(0, 1.38, -0.06);
    accessoryGroup.add(haloRing);
  } else if (spec.accessory === 'royal-crown') {
    const crownGeo = trackGeo(new THREE.CylinderGeometry(0.38, 0.3, 0.32, 6));
    addOutlinedMesh(accessoryGroup, crownGeo, toonMat('#FACC15'), [0, 1.24, 0.04]);
  } else if (spec.accessory === 'witch-hat') {
    const brimGeo = trackGeo(new THREE.CylinderGeometry(1.1, 1.1, 0.06, 28));
    const coneGeo = trackGeo(new THREE.ConeGeometry(0.62, 1.15, 24));
    addOutlinedMesh(accessoryGroup, brimGeo, toonMat('#1E1B4B'), [0, 1.05, 0], [0.1, 0, -0.08]);
    addOutlinedMesh(accessoryGroup, coneGeo, toonMat('#1E1B4B'), [0.06, 1.6, -0.06], [0.1, 0, -0.12]);
  }

  // Side Headphones when selected
  if (spec.sideAddon === 'studio-headphones' || spec.sideAddon === 'mic-boom') {
    const bandGeo = trackGeo(new THREE.TorusGeometry(1.06, 0.06, 14, 40, Math.PI));
    const band = new THREE.Mesh(bandGeo, toonMat('#1E293B'));
    band.position.set(0, 0.24, 0);
    headGroup.add(band);

    const cupGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 24));
    [-1, 1].forEach((dir) => {
      const cup = new THREE.Mesh(cupGeo, accentMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(dir * 1.04, 0.2, 0.04);
      headGroup.add(cup);
    });
  }

  return {
    root,
    hoverPivot,
    headGroup,
    eyeLeft,
    eyeRight,
    irisRing: null,
    irisCore: null,
    slitMarker: null,
    waveformEyeBars: [],
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
      for (const t of textures) t.dispose();
    },
  };
}
