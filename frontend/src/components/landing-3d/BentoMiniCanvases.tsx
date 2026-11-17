"use client";

import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { AGENT_COLORS } from "./theme";

const HEAD_MODEL_URL = "/models/head.glb";

if (typeof window !== "undefined") {
  useGLTF.preload(HEAD_MODEL_URL);
}

function useInViewPause() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]) setInView(entries[0].isIntersecting);
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

function PointCloudMesh({ isDark }: { isDark: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  // Deterministic Fibonacci sphere point cloud (~220 semantic vertices)
  const positions = useMemo(() => {
    const count = 220;
    const arr = new Float32Array(count * 3);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      const r = 1.05 + (i % 3) * 0.08;
      arr[i * 3] = Math.cos(theta) * radiusAtY * r;
      arr[i * 3 + 1] = y * r;
      arr[i * 3 + 2] = Math.sin(theta) * radiusAtY * r;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.45;
      groupRef.current.rotation.x += dt * 0.18;
    }
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={isDark ? AGENT_COLORS.intentParser : AGENT_COLORS.policyCore}
          size={0.075}
          sizeAttenuation
          transparent
          opacity={0.92}
        />
      </points>

      {/* Subtle Inner Wireframe Lattice */}
      <mesh>
        <icosahedronGeometry args={[0.72, 1]} />
        <meshBasicMaterial
          color={AGENT_COLORS.policyCore}
          wireframe
          transparent
          opacity={0.34}
        />
      </mesh>
    </group>
  );
}

export function IntentPointCloudCanvas({ isDark = true }: { isDark?: boolean }) {
  const { ref, inView } = useInViewPause();
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [isMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });

  return (
    <div
      ref={ref}
      className={`w-full h-36 rounded-2xl border overflow-hidden relative flex items-center justify-center transition-colors ${
        isDark
          ? "bg-[#05070F]/80 border-white/10"
          : "bg-indigo-50/50 border-indigo-200/70"
      }`}
    >
      {!isMobile && !prefersReducedMotion ? (
        <Canvas
          dpr={[1, 1.75]}
          frameloop={inView ? "always" : "never"}
          camera={{ position: [0, 0, 3.2], fov: 40 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          className="w-full h-full block"
        >
          <PointCloudMesh isDark={isDark} />
        </Canvas>
      ) : (
        <div
          className={`flex flex-col items-center space-y-1.5 ${
            isDark ? "text-[#22D3EE]" : "text-[#0E7490]"
          }`}
        >
          <Sparkles className="h-7 w-7 animate-pulse" />
          <span className="text-[10px] font-mono font-bold">
            Semantic Vector Cloud
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HUMAN GOVERNANCE: SCANNED 3D HEAD HOLOGRAM (LEE PERRY-SMITH SCAN, CC BY 3.0)
// =============================================================================

interface SampledHeadCloud {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  normals: Float32Array;
  curvature: Float32Array;
  randoms: Float32Array;
  groundY: number;
}

function hashGridKey(ix: number, iy: number, iz: number): number {
  // Deterministic 3D integer grid hash (21 bits safe)
  return ((ix + 512) * 1048576) + ((iy + 512) * 1024) + (iz + 512);
}

function buildSampledHeadData(rootScene: THREE.Object3D, targetCount: number): SampledHeadCloud {
  let sourceMesh: THREE.Mesh | null = null;
  rootScene.traverse((obj) => {
    if (!sourceMesh && obj instanceof THREE.Mesh && obj.geometry) {
      sourceMesh = obj;
    }
  });

  if (!sourceMesh) {
    throw new Error("No mesh found inside head.glb");
  }

  const foundMesh = sourceMesh as THREE.Mesh;
  foundMesh.updateWorldMatrix(true, false);
  const bakedGeo = foundMesh.geometry.clone();
  bakedGeo.applyMatrix4(foundMesh.matrixWorld);
  if (!bakedGeo.attributes.normal) {
    bakedGeo.computeVertexNormals();
  }

  bakedGeo.computeBoundingBox();
  const bb = bakedGeo.boundingBox!;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bb.getSize(size);
  bb.getCenter(center);

  // Normalize uniformly to fit within [-1..+1] bounding cube centered cleanly at origin
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 2.0 / maxDim;
  bakedGeo.translate(-center.x, -center.y, -center.z);
  bakedGeo.scale(scale, scale, scale);
  bakedGeo.computeBoundingBox();
  const normMinY = bakedGeo.boundingBox ? bakedGeo.boundingBox.min.y : -0.93;

  const bakedMesh = new THREE.Mesh(bakedGeo);
  const sampler = new MeshSurfaceSampler(bakedMesh).build();

  const positions = new Float32Array(targetCount * 3);
  const normals = new Float32Array(targetCount * 3);
  const curvature = new Float32Array(targetCount);
  const randoms = new Float32Array(targetCount);

  // Spatial hash relaxation avoids clumping & guarantees uniform non-striped density
  const cellSize = targetCount > 10000 ? 0.0155 : 0.024;
  const minDist = targetCount > 10000 ? 0.0108 : 0.017;
  const minDistSq = minDist * minDist;
  const grid = new Map<number, number[]>();

  const p = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < targetCount; i++) {
    let accepted = false;
    let bestPx = 0,
      bestPy = 0,
      bestPz = 0;
    let bestNx = 0,
      bestNy = 0,
      bestNz = 1;

    for (let attempt = 0; attempt < 6; attempt++) {
      sampler.sample(p, n);
      if (attempt === 0) {
        bestPx = p.x;
        bestPy = p.y;
        bestPz = p.z;
        bestNx = n.x;
        bestNy = n.y;
        bestNz = n.z;
      }

      const gx = Math.floor(p.x / cellSize);
      const gy = Math.floor(p.y / cellSize);
      const gz = Math.floor(p.z / cellSize);

      let tooClose = false;
      for (let dx = -1; dx <= 1 && !tooClose; dx++) {
        for (let dy = -1; dy <= 1 && !tooClose; dy++) {
          for (let dz = -1; dz <= 1 && !tooClose; dz++) {
            const bucket = grid.get(hashGridKey(gx + dx, gy + dy, gz + dz));
            if (!bucket) continue;
            for (let b = 0; b < bucket.length; b++) {
              const j = bucket[b];
              const vx = positions[j * 3] - p.x;
              const vy = positions[j * 3 + 1] - p.y;
              const vz = positions[j * 3 + 2] - p.z;
              if (vx * vx + vy * vy + vz * vz < minDistSq) {
                tooClose = true;
                break;
              }
            }
          }
        }
      }

      if (!tooClose) {
        bestPx = p.x;
        bestPy = p.y;
        bestPz = p.z;
        bestNx = n.x;
        bestNy = n.y;
        bestNz = n.z;
        accepted = true;
        break;
      }
    }

    positions[i * 3] = bestPx;
    positions[i * 3 + 1] = bestPy;
    positions[i * 3 + 2] = bestPz;

    normals[i * 3] = bestNx;
    normals[i * 3 + 1] = bestNy;
    normals[i * 3 + 2] = bestNz;

    const finalKey = hashGridKey(
      Math.floor(bestPx / cellSize),
      Math.floor(bestPy / cellSize),
      Math.floor(bestPz / cellSize)
    );
    const list = grid.get(finalKey);
    if (list) {
      list.push(i);
    } else {
      grid.set(finalKey, [i]);
    }

    // Deterministic per-dot random value [0..1] derived from low-discrepancy golden fractional
    randoms[i] = ((i * 0.61803398875 + (accepted ? 0.13 : 0.37)) % 1 + 1) % 1;
  }

  // O(N) spatial-hash normal divergence estimate highlights high-curvature anatomy (eyes, nose, lips)
  const curvRadiusSq = (cellSize * 2.1) * (cellSize * 2.1);
  for (let i = 0; i < targetCount; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];

    const gx = Math.floor(px / cellSize);
    const gy = Math.floor(py / cellSize);
    const gz = Math.floor(pz / cellSize);

    let sumDot = 0;
    let neighborCount = 0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(hashGridKey(gx + dx, gy + dy, gz + dz));
          if (!bucket) continue;
          for (let b = 0; b < bucket.length && neighborCount < 14; b++) {
            const j = bucket[b];
            if (j === i) continue;
            const vx = positions[j * 3] - px;
            const vy = positions[j * 3 + 1] - py;
            const vz = positions[j * 3 + 2] - pz;
            if (vx * vx + vy * vy + vz * vz <= curvRadiusSq) {
              const d = nx * normals[j * 3] + ny * normals[j * 3 + 1] + nz * normals[j * 3 + 2];
              sumDot += Math.max(0, Math.min(1, d));
              neighborCount++;
            }
          }
        }
      }
    }

    const avgAlignment = neighborCount > 0 ? sumDot / neighborCount : 1;
    // Scale normal variation cleanly into [0..1]
    curvature[i] = Math.min(1, Math.max(0, (1 - avgAlignment) * 5.2));
  }

  return {
    geometry: bakedGeo,
    positions,
    normals,
    curvature,
    randoms,
    groundY: normMinY - 0.055,
  };
}

const HEAD_POINTS_VERTEX = /* glsl */ `
  attribute float aCurvature;
  attribute float aRandom;

  uniform float uTime;
  uniform float uScanY;
  uniform float uPixelRatio;

  varying float vTone;
  varying float vAlpha;
  varying float vScanCore;

  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vec3 vNormal = normalize(normalMatrix * normal);
    vec3 vViewDir = normalize(-mvPos.xyz);

    // (a) View-dependent diffuse from front-left key direction
    vec3 keyDir = normalize(vec3(-0.45, 0.35, 0.82));
    float diffuse = clamp(dot(vNormal, keyDir), 0.0, 1.0);

    // (b) Fresnel silhouette rim glow
    float ndotv = dot(vNormal, vViewDir);
    float facing = clamp(ndotv, 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.35) * smoothstep(-0.28, 0.14, ndotv);

    // (c) Depth fade so far/back points recede cleanly
    float frontSide = smoothstep(-0.55, 0.25, ndotv);
    float depthFade = smoothstep(-0.85, 0.65, position.z);
    float backDim = mix(0.14, 1.0, frontSide * (0.45 + 0.55 * depthFade));

    // Horizontal scan band (+brightness inside band + thin bright center line)
    float distScan = abs(position.y - uScanY);
    float scanBand = smoothstep(0.22, 0.0, distScan);
    float scanLine = smoothstep(0.026, 0.0, distScan);

    // ~3% star dots with slow luminous twinkle
    float isStar = step(0.97, fract(aRandom * 31.73));
    float twinkle = isStar * (0.5 + 0.5 * sin(uTime * 1.9 + aRandom * 19.0));

    float shading = diffuse * 0.52 + fresnel * 0.58 + aCurvature * 0.34;
    vTone = clamp(shading * backDim + scanBand * 0.48 + scanLine * 0.52 + twinkle * 0.55, 0.0, 1.15);
    vAlpha = clamp((0.26 + shading * 0.62) * backDim + scanBand * 0.32 + scanLine * 0.45 + twinkle * 0.35, 0.06, 0.98);
    vScanCore = clamp(scanLine + twinkle * 0.6, 0.0, 1.0);

    // Crisp fine point sizes (~1.3 - 2.2 CSS px equivalent, slightly boosted on landmarks/stars)
    float baseSize = 1.45 + aCurvature * 0.42 + scanBand * 0.35 + isStar * 0.65 + scanLine * 0.45;
    gl_PointSize = baseSize * uPixelRatio * (4.95 / max(-mvPos.z, 1.2));
    gl_Position = projectionMatrix * mvPos;
  }
`;

const HEAD_POINTS_FRAGMENT = /* glsl */ `
  uniform vec3 uColorBase;
  uniform vec3 uColorMid;
  uniform vec3 uColorHighlight;

  varying float vTone;
  varying float vAlpha;
  varying float vScanCore;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float sprite = smoothstep(0.5, 0.08, dist);
    vec3 col = mix(uColorBase, uColorMid, smoothstep(0.12, 0.58, vTone));
    col = mix(col, uColorHighlight, smoothstep(0.56, 1.02, vTone + vScanCore * 0.25));

    gl_FragColor = vec4(col, sprite * vAlpha);
  }
`;

const HOLO_SHELL_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const HOLO_SHELL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float ndotv = clamp(dot(vNormal, vViewDir), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 2.2);
    gl_FragColor = vec4(uColor, fresnel * uOpacity);
  }
`;

class HeadErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function SuspenseDottedCircle() {
  const groupRef = useRef<THREE.Group>(null);
  const positions = useMemo(() => {
    const count = 96;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * 0.72;
      arr[i * 3 + 1] = Math.sin(a) * 0.72;
      arr[i * 3 + 2] = 0;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const pulse = 0.94 + Math.sin(state.clock.elapsedTime * 3.0) * 0.06;
    groupRef.current.scale.setScalar(pulse);
    groupRef.current.rotation.z = state.clock.elapsedTime * 0.25;
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#38BDF8"
          size={0.045}
          sizeAttenuation
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function HeadSilhouetteFallback({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  // Clean 2D profile/front bust silhouette outline rendered purely as soft cyan dots
  const positions = useMemo(() => {
    const outline: Array<[number, number]> = [
      // Right jaw & cheek contour -> crown -> left cheek & jaw -> neck/shoulders
      [-0.68, -0.82],
      [-0.36, -0.68],
      [-0.28, -0.44],
      [-0.44, -0.22],
      [-0.50, 0.06],
      [-0.48, 0.34],
      [-0.38, 0.62],
      [-0.18, 0.80],
      [0.0, 0.86],
      [0.18, 0.80],
      [0.38, 0.62],
      [0.48, 0.34],
      [0.50, 0.06],
      [0.44, -0.22],
      [0.28, -0.44],
      [0.36, -0.68],
      [0.68, -0.82],
    ];
    const pts: number[] = [];
    for (let i = 0; i < outline.length - 1; i++) {
      const [x0, y0] = outline[i];
      const [x1, y1] = outline[i + 1];
      const segs = 12;
      for (let s = 0; s < segs; s++) {
        const u = s / segs;
        pts.push(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 0);
      }
    }
    // Minimal eye/nose/brow dot accents along horizontal midline
    for (let x = -0.24; x <= -0.10; x += 0.035) pts.push(x, 0.14, 0.02);
    for (let x = 0.10; x <= 0.24; x += 0.035) pts.push(x, 0.14, 0.02);
    for (let y = -0.14; y <= 0.12; y += 0.04) pts.push(0, y, 0.03);
    for (let x = -0.11; x <= 0.11; x += 0.035) pts.push(x, -0.26, 0.02);
    return new Float32Array(pts);
  }, []);

  useFrame((state) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.35;
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#38BDF8"
          size={0.045}
          sizeAttenuation
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function ScannedHeadHologram({
  pointCount,
  reducedMotion,
  isCardHovered,
}: {
  pointCount: number;
  reducedMotion: boolean;
  isCardHovered: boolean;
}) {
  const gltf = useGLTF(HEAD_MODEL_URL);

  const headCloud = useMemo(
    () => buildSampledHeadData(gltf.scene, pointCount),
    [gltf.scene, pointCount]
  );

  useEffect(() => {
    return () => {
      headCloud.geometry.dispose();
    };
  }, [headCloud]);

  const headGroupRef = useRef<THREE.Group>(null);
  const pointsMatRef = useRef<THREE.ShaderMaterial>(null);
  const scanLineMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const scanLineMeshRef = useRef<THREE.Mesh>(null);
  const beaconMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const beaconHaloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const beaconHaloMeshRef = useRef<THREE.Mesh>(null);

  const tiltRef = useRef({ x: 0, y: 0 });
  const amberColor = useMemo(() => new THREE.Color("#FBBF24"), []);
  const emeraldColor = useMemo(() => new THREE.Color("#34D399"), []);
  const beaconBlendRef = useRef(0);

  const [pointUniforms] = useState(() => ({
    uTime: { value: 0 },
    uScanY: { value: 0.12 },
    uPixelRatio: { value: 1.25 },
    uColorBase: { value: new THREE.Color("#1E6FD9") },
    uColorMid: { value: new THREE.Color("#38BDF8") },
    uColorHighlight: { value: new THREE.Color("#E6F9FF") },
  }));

  const [shellUniforms] = useState(() => ({
    uColor: { value: new THREE.Color("#38BDF8") },
    uOpacity: { value: 0.055 },
  }));

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const dpr = Math.min(state.gl.getPixelRatio(), 1.5);

    if (pointsMatRef.current) {
      pointsMatRef.current.uniforms.uPixelRatio.value = dpr;
    }

    // Smooth amber -> emerald beacon transition on card hover
    beaconBlendRef.current = THREE.MathUtils.lerp(
      beaconBlendRef.current,
      isCardHovered ? 1 : 0,
      1 - Math.exp(-8 * dt)
    );
    if (beaconMatRef.current) {
      beaconMatRef.current.color.lerpColors(amberColor, emeraldColor, beaconBlendRef.current);
      beaconMatRef.current.opacity = reducedMotion ? 0.9 : 0.7 + Math.sin(t * 3.4) * 0.25;
    }
    if (beaconHaloMatRef.current) {
      beaconHaloMatRef.current.color.lerpColors(amberColor, emeraldColor, beaconBlendRef.current);
    }

    if (reducedMotion) {
      if (headGroupRef.current) {
        headGroupRef.current.position.y = 0;
        headGroupRef.current.rotation.set(0, 0, 0);
      }
      if (scanLineMeshRef.current) {
        scanLineMeshRef.current.position.y = 0.12;
      }
      if (pointsMatRef.current) {
        pointsMatRef.current.uniforms.uTime.value = 0;
        pointsMatRef.current.uniforms.uScanY.value = 0.12;
      }
      return;
    }

    // Slow yaw sweep (+/- ~51 deg) + gentle float
    const sweepYaw = Math.sin(t * 0.3) * 0.9;
    const floatY = Math.sin(t * 0.85) * 0.032;
    const scanY = Math.sin(t * 0.65) * 0.84;

    // Tiny damped pointer-following tilt (max 5 deg)
    const targetTiltX = -state.pointer.y * 0.075;
    const targetTiltY = state.pointer.x * 0.085;
    const alpha = 1 - Math.exp(-6 * dt);
    tiltRef.current.x = THREE.MathUtils.lerp(tiltRef.current.x, targetTiltX, alpha);
    tiltRef.current.y = THREE.MathUtils.lerp(tiltRef.current.y, targetTiltY, alpha);

    if (headGroupRef.current) {
      headGroupRef.current.position.y = floatY;
      headGroupRef.current.rotation.x = tiltRef.current.x;
      headGroupRef.current.rotation.y = sweepYaw + tiltRef.current.y;
    }

    if (pointsMatRef.current) {
      pointsMatRef.current.uniforms.uTime.value = t;
      pointsMatRef.current.uniforms.uScanY.value = scanY;
    }

    if (scanLineMeshRef.current) {
      scanLineMeshRef.current.position.y = scanY;
      const bandTaper = Math.max(0.5, 1.0 - Math.pow(scanY / 0.95, 2) * 0.36);
      scanLineMeshRef.current.scale.set(bandTaper, bandTaper, 1);
    }
    if (scanLineMatRef.current) {
      scanLineMatRef.current.opacity = 0.24 + Math.sin(t * 2.5) * 0.05;
    }

    if (beaconHaloMeshRef.current) {
      const pulseScale = 1 + (0.5 + 0.5 * Math.sin(t * 3.4)) * 0.45;
      beaconHaloMeshRef.current.scale.setScalar(pulseScale);
    }
  });

  return (
    <group>
      <group ref={headGroupRef}>
        {/* Uniform Random Sampled Holographic Point Cloud */}
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[headCloud.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-normal"
              args={[headCloud.normals, 3]}
            />
            <bufferAttribute
              attach="attributes-aCurvature"
              args={[headCloud.curvature, 1]}
            />
            <bufferAttribute
              attach="attributes-aRandom"
              args={[headCloud.randoms, 1]}
            />
          </bufferGeometry>
          <shaderMaterial
            ref={pointsMatRef}
            vertexShader={HEAD_POINTS_VERTEX}
            fragmentShader={HEAD_POINTS_FRAGMENT}
            uniforms={pointUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>

        {/* Faint Additive Fresnel Surface Shell (opacity <= 0.06) */}
        <mesh geometry={headCloud.geometry}>
          <shaderMaterial
            vertexShader={HOLO_SHELL_VERTEX}
            fragmentShader={HOLO_SHELL_FRAGMENT}
            uniforms={shellUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Forehead Approval Gate Beacon (Amber -> Emerald on Hover) */}
        <group position={[0, 0.37, 0.58]}>
          <mesh>
            <sphereGeometry args={[0.022, 12, 12]} />
            <meshBasicMaterial
              ref={beaconMatRef}
              color="#FBBF24"
              transparent
              opacity={0.9}
            />
          </mesh>
          <mesh ref={beaconHaloMeshRef}>
            <ringGeometry args={[0.036, 0.049, 24]} />
            <meshBasicMaterial
              ref={beaconHaloMatRef}
              color="#FBBF24"
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>

      {/* Thin Bright Horizontal Scan Line Ring */}
      <mesh ref={scanLineMeshRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[0.82, 0.836, 72]} />
        <meshBasicMaterial
          ref={scanLineMatRef}
          color="#E6F9FF"
          transparent
          opacity={0.26}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Thin Dim Ground Ring Below Bust/Neck Cut */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, headCloud.groundY, 0]}>
        <ringGeometry args={[0.92, 0.945, 72]} />
        <meshBasicMaterial
          color="#38BDF8"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function GovernanceGlassShieldCanvas({
  isDark = true,
}: {
  isDark?: boolean;
}) {
  const { ref, inView } = useInViewPause();
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [isMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });

  const pointCount = isMobile ? 6000 : 14000;

  return (
    <div
      ref={ref}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
      aria-label="Holographic 3D scanned human head representing Human Governance approval checkpoint"
      className={`w-full min-h-[280px] h-[280px] sm:h-[300px] rounded-2xl border overflow-hidden relative flex items-center justify-center transition-colors ${
        isDark
          ? "bg-[#050814] border-white/10"
          : "bg-[#070B18] border-indigo-200/80 shadow-inner"
      }`}
    >
      <Canvas
        dpr={[1, 1.5]}
        frameloop={prefersReducedMotion ? "demand" : inView ? "always" : "never"}
        camera={{ position: [0, 0, 4.95], fov: 34 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        className="w-full h-full block"
      >
        <HeadErrorBoundary
          fallback={<HeadSilhouetteFallback reducedMotion={prefersReducedMotion} />}
        >
          <Suspense fallback={<SuspenseDottedCircle />}>
            <ScannedHeadHologram
              pointCount={pointCount}
              reducedMotion={prefersReducedMotion}
              isCardHovered={isCardHovered}
            />
          </Suspense>
        </HeadErrorBoundary>
      </Canvas>

      {/* Subtle Bottom-Left State Indicator Synced With Forehead Beacon */}
      <div className="pointer-events-none absolute bottom-2.5 left-3 flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md">
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
            isCardHovered ? "bg-[#34D399]" : "bg-[#FBBF24] animate-pulse"
          }`}
        />
        <span
          className={`text-[9px] font-mono font-bold tracking-wider transition-colors duration-300 ${
            isCardHovered ? "text-[#34D399]" : "text-[#FBBF24]"
          }`}
        >
          {isCardHovered ? "GATE_APPROVED" : "WAITING_FOR_HUMAN"}
        </span>
      </div>

      {/* CC BY 3.0 Attribution Credits Note */}
      <div className="pointer-events-none absolute bottom-2.5 right-3 text-[9px] font-mono text-[#8B95B0]/85">
        Head scan: Lee Perry-Smith (CC BY 3.0)
      </div>
    </div>
  );
}
