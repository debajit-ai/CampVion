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
  crownY: number;
  groundY: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashGridKey(ix: number, iy: number, iz: number): number {
  return (ix + 512) * 1048576 + (iy + 512) * 1024 + (iz + 512);
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

  // Normalize uniformly so model fits cleanly within [-1..+1] bounds centered at origin
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 2.0 / maxDim;
  bakedGeo.translate(-center.x, -center.y, -center.z);
  bakedGeo.scale(scale, scale, scale);
  bakedGeo.computeBoundingBox();

  const normMinY = bakedGeo.boundingBox ? bakedGeo.boundingBox.min.y : -0.93;
  const normMaxY = bakedGeo.boundingBox ? bakedGeo.boundingBox.max.y : 0.93;

  const bakedMesh = new THREE.Mesh(bakedGeo);
  const sampler = new MeshSurfaceSampler(bakedMesh).build();
  const rand = mulberry32(20261118);

  const positions = new Float32Array(targetCount * 3);
  const normals = new Float32Array(targetCount * 3);
  const curvature = new Float32Array(targetCount);
  const randoms = new Float32Array(targetCount);

  const isDesktop = targetCount > 12000;
  const cellSize = isDesktop ? 0.013 : 0.019;
  const faceMinDistSq = Math.pow(isDesktop ? 0.0044 : 0.0068, 2);
  const backMinDistSq = Math.pow(isDesktop ? 0.0125 : 0.019, 2);
  const grid = new Map<number, number[]>();

  const p = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < targetCount; i++) {
    let bestPx = 0,
      bestPy = 0,
      bestPz = 0;
    let bestNx = 0,
      bestNy = 0,
      bestNz = 1;
    let picked = false;

    for (let attempt = 0; attempt < 18; attempt++) {
      sampler.sample(p, n);

      // Skip underside bottom cut rim & wide outer shoulder extremes
      if (p.y < -0.74 && n.y < -0.68) continue;
      if (Math.abs(p.x) > 0.70 && p.y < -0.25) continue;

      // Drop mouth-interior pocket geometry & inward-facing mouth cavity walls (preserves outer lips cleanly)
      const inMouthPocketDepth =
        Math.abs(p.x) < 0.145 && p.y >= 0.095 && p.y <= 0.235 && p.z > 0.20 && p.z < 0.48;
      const inMouthInwardNormal =
        Math.abs(p.x) < 0.165 && p.y >= 0.095 && p.y <= 0.235 && p.z > 0.24 && n.z < 0.05;
      if (inMouthPocketDepth || inMouthInwardNormal) continue;

      // Smooth front-hemisphere facial importance weight (no rectangular boundary step)
      const fxNorm = p.x / 0.44;
      const fyNorm = (p.y - 0.28) / 0.36;
      const faceWeight = p.z > 0.05 && fxNorm * fxNorm + fyNorm * fyNorm < 1.15;

      if (!faceWeight && attempt < 12 && rand() > 0.4) {
        continue;
      }

      if (!picked) {
        bestPx = p.x;
        bestPy = p.y;
        bestPz = p.z;
        bestNx = n.x;
        bestNy = n.y;
        bestNz = n.z;
        picked = true;
      }

      const gx = Math.floor(p.x / cellSize);
      const gy = Math.floor(p.y / cellSize);
      const gz = Math.floor(p.z / cellSize);
      const threshSq = faceWeight ? faceMinDistSq : backMinDistSq;

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
              if (vx * vx + vy * vy + vz * vz < threshSq) {
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

    randoms[i] = ((i * 0.61803398875 + 0.17) % 1 + 1) % 1;
  }

  // O(N) spatial-hash normal divergence highlights subtle features (lips, nose ridge, brows)
  const curvRadiusSq = Math.pow(cellSize * 2.2, 2);
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
    curvature[i] = Math.min(1, Math.max(0, (1 - avgAlignment) * 4.5));
  }

  return {
    geometry: bakedGeo,
    positions,
    normals,
    curvature,
    randoms,
    crownY: normMaxY,
    groundY: normMinY - 0.04,
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

    // Smooth wrapped front-left diffuse + soft frontal fill so eye/mouth folds stay softly shaded, never empty holes
    vec3 keyDir = normalize(vec3(-0.42, 0.35, 0.84));
    float halfLambert = dot(vNormal, keyDir) * 0.5 + 0.5;
    float frontFill = clamp(dot(vNormal, vec3(0.0, 0.12, 1.0)) * 0.5 + 0.5, 0.0, 1.0);
    float smoothDiffuse = mix(frontFill, halfLambert, 0.65);

    // Subtle fresnel rim suppressed cleanly near the lower bust fade so bottom edge never glows bright
    float ndotv = dot(vNormal, vViewDir);
    float facing = clamp(ndotv, 0.0, 1.0);
    float bustHeightMask = smoothstep(-0.68, -0.15, position.y);
    float fresnel = pow(1.0 - facing, 2.5) * smoothstep(-0.25, 0.2, ndotv) * bustHeightMask;

    // Back-of-head & inward-facing normal attenuation so inward lip creases dim cleanly while outward lips highlight
    float frontVisible = smoothstep(-0.25, 0.28, ndotv);
    float depthFade = smoothstep(-0.85, 0.62, position.z);
    float mouthInwardFade = (position.z > 0.25 && position.y > 0.09 && position.y < 0.24 && abs(position.x) < 0.17)
      ? smoothstep(-0.08, 0.28, vNormal.z)
      : 1.0;
    float visibilityMask = mix(0.16, 1.0, frontVisible * (0.42 + 0.58 * depthFade)) * mix(0.28, 1.0, mouthInwardFade);

    // Vertical fade over the lowest 25% of the bust ([-0.93 .. -0.46]) + shoulder lateral taper
    float bottomFade = smoothstep(-0.89, -0.45, position.y);
    float lowerBand = 1.0 - smoothstep(-0.52, -0.16, position.y);
    float shoulderFade = 1.0 - smoothstep(0.46, 0.69, abs(position.x)) * lowerBand;
    float edgeMask = bottomFade * shoulderFade;

    // Subtle horizontal scan band on dots (slow ~6s full pass)
    float distScan = abs(position.y - uScanY);
    float scanBand = smoothstep(0.20, 0.0, distScan);
    float scanLine = smoothstep(0.022, 0.0, distScan);

    // ~3% soft star dots with slow twinkle
    float isStar = step(0.97, fract(aRandom * 31.73));
    float twinkle = isStar * (0.5 + 0.5 * sin(uTime * 1.7 + aRandom * 19.0));

    float shading = smoothDiffuse * 0.62 + fresnel * 0.42 + aCurvature * 0.18;
    vTone = clamp(shading * visibilityMask + scanBand * 0.24 + scanLine * 0.20 + twinkle * 0.40, 0.0, 1.05);
    vAlpha = clamp((0.22 + shading * 0.56) * visibilityMask + scanBand * 0.18 + scanLine * 0.18 + twinkle * 0.22, 0.04, 0.90) * edgeMask;
    vScanCore = clamp(scanLine * 0.72 + twinkle * 0.45, 0.0, 1.0);

    // Smaller, more uniform holographic point sizes (~1.1 - 1.65 px equivalent)
    float baseSize = 1.12 + aCurvature * 0.14 + scanBand * 0.12 + isStar * 0.32;
    gl_PointSize = baseSize * uPixelRatio * (3.82 / max(-mvPos.z, 1.2));
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
    if (vAlpha < 0.01) discard;
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float sprite = smoothstep(0.5, 0.10, dist);
    vec3 col = mix(uColorBase, uColorMid, smoothstep(0.14, 0.58, vTone));
    col = mix(col, uColorHighlight, smoothstep(0.58, 1.02, vTone + vScanCore * 0.22));

    gl_FragColor = vec4(col, sprite * vAlpha);
  }
`;

const HOLO_SHELL_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;

  void main() {
    vLocalPos = position;
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
  varying vec3 vLocalPos;

  void main() {
    float ndotv = clamp(dot(vNormal, vViewDir), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 2.3);
    float bottomFade = smoothstep(-0.88, -0.44, vLocalPos.y);
    float lowerBand = 1.0 - smoothstep(-0.52, -0.16, vLocalPos.y);
    float shoulderFade = 1.0 - smoothstep(0.46, 0.69, abs(vLocalPos.x)) * lowerBand;
    gl_FragColor = vec4(uColor, fresnel * uOpacity * bottomFade * shoulderFade);
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

  const positions = useMemo(() => {
    const outline: Array<[number, number]> = [
      [-0.48, -0.78],
      [-0.32, -0.62],
      [-0.26, -0.40],
      [-0.42, -0.18],
      [-0.48, 0.08],
      [-0.46, 0.36],
      [-0.36, 0.64],
      [-0.18, 0.82],
      [0.0, 0.88],
      [0.18, 0.82],
      [0.36, 0.64],
      [0.46, 0.36],
      [0.48, 0.08],
      [0.42, -0.18],
      [0.26, -0.40],
      [0.32, -0.62],
      [0.48, -0.78],
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
    for (let x = -0.22; x <= -0.10; x += 0.03) pts.push(x, 0.16, 0.02);
    for (let x = 0.10; x <= 0.22; x += 0.03) pts.push(x, 0.16, 0.02);
    for (let y = -0.10; y <= 0.14; y += 0.035) pts.push(0, y, 0.03);
    for (let x = -0.11; x <= 0.11; x += 0.03) pts.push(x, -0.22, 0.02);
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
          size={0.04}
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

  // Thin vertical dotted tether line from crown (+0.93) to overhead beacon (+1.17)
  const tetherPositions = useMemo(() => {
    const dots = 6;
    const arr = new Float32Array(dots * 3);
    const yStart = headCloud.crownY + 0.025;
    const yEnd = headCloud.crownY + 0.20;
    for (let i = 0; i < dots; i++) {
      const u = i / (dots - 1);
      arr[i * 3] = 0;
      arr[i * 3 + 1] = yStart + (yEnd - yStart) * u;
      arr[i * 3 + 2] = 0;
    }
    return arr;
  }, [headCloud.crownY]);

  useEffect(() => {
    return () => {
      headCloud.geometry.dispose();
    };
  }, [headCloud]);

  const headGroupRef = useRef<THREE.Group>(null);
  const pointsMatRef = useRef<THREE.ShaderMaterial>(null);
  const beaconMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const beaconHaloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const tetherMatRef = useRef<THREE.PointsMaterial>(null);
  const beaconHaloMeshRef = useRef<THREE.Mesh>(null);

  const tiltRef = useRef({ x: 0, y: 0 });
  const amberColor = useMemo(() => new THREE.Color("#FBBF24"), []);
  const emeraldColor = useMemo(() => new THREE.Color("#34D399"), []);
  const beaconBlendRef = useRef(0);

  const [pointUniforms] = useState(() => ({
    uTime: { value: 0 },
    uScanY: { value: 0.14 },
    uPixelRatio: { value: 1.25 },
    uColorBase: { value: new THREE.Color("#1E6FD9") },
    uColorMid: { value: new THREE.Color("#38BDF8") },
    uColorHighlight: { value: new THREE.Color("#E6F9FF") },
  }));

  const [shellUniforms] = useState(() => ({
    uColor: { value: new THREE.Color("#38BDF8") },
    uOpacity: { value: 0.048 },
  }));

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const dpr = Math.min(state.gl.getPixelRatio(), 1.5);

    if (pointsMatRef.current) {
      pointsMatRef.current.uniforms.uPixelRatio.value = dpr;
    }

    // Smooth amber -> emerald beacon & tether transition on card hover
    beaconBlendRef.current = THREE.MathUtils.lerp(
      beaconBlendRef.current,
      isCardHovered ? 1 : 0,
      1 - Math.exp(-8 * dt)
    );
    if (beaconMatRef.current) {
      beaconMatRef.current.color.lerpColors(amberColor, emeraldColor, beaconBlendRef.current);
      beaconMatRef.current.opacity = reducedMotion ? 0.92 : 0.72 + Math.sin(t * 3.2) * 0.24;
    }
    if (beaconHaloMatRef.current) {
      beaconHaloMatRef.current.color.lerpColors(amberColor, emeraldColor, beaconBlendRef.current);
    }
    if (tetherMatRef.current) {
      tetherMatRef.current.color.lerpColors(amberColor, emeraldColor, beaconBlendRef.current);
    }

    if (reducedMotion) {
      if (headGroupRef.current) {
        headGroupRef.current.position.y = 0;
        headGroupRef.current.rotation.set(0, 0, 0);
      }
      if (pointsMatRef.current) {
        pointsMatRef.current.uniforms.uTime.value = 0;
        pointsMatRef.current.uniforms.uScanY.value = 0.14;
      }
      return;
    }

    // Slow yaw sweep (+/- ~51 deg) + gentle float; slower ~6s scan band cycle
    const sweepYaw = Math.sin(t * 0.3) * 0.9;
    const floatY = Math.sin(t * 0.85) * 0.025;
    const scanY = Math.sin(t * ((Math.PI * 2) / 6.0)) * 0.82;

    // Tiny damped pointer-following tilt (max 5 deg)
    const targetTiltX = -state.pointer.y * 0.07;
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

    if (beaconHaloMeshRef.current) {
      const pulseScale = 1 + (0.5 + 0.5 * Math.sin(t * 3.2)) * 0.42;
      beaconHaloMeshRef.current.scale.setScalar(pulseScale);
    }
  });

  // Floating beacon sits cleanly above the crown
  const beaconY = headCloud.crownY + 0.24;

  return (
    <group>
      <group ref={headGroupRef}>
        {/* Front-Weighted Dense Holographic Point Cloud */}
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

        {/* Faint Additive Fresnel Surface Shell (fades cleanly at bust bottom & outer shoulders) */}
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

        {/* Thin Vertical Dotted Tether Connecting Crown to Overhead Governance Beacon */}
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[tetherPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            ref={tetherMatRef}
            color="#FBBF24"
            size={0.022}
            sizeAttenuation
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </points>

        {/* Governance Approval Gate Beacon Floating Above Crown (Never Overlaps Face) */}
        <group position={[0, beaconY, 0]}>
          <mesh>
            <sphereGeometry args={[0.024, 12, 12]} />
            <meshBasicMaterial
              ref={beaconMatRef}
              color="#FBBF24"
              transparent
              opacity={0.92}
            />
          </mesh>
          <mesh ref={beaconHaloMeshRef}>
            <ringGeometry args={[0.04, 0.056, 28]} />
            <meshBasicMaterial
              ref={beaconHaloMatRef}
              color="#FBBF24"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>

      {/* One Thin Dim Ground Ring Centered Under Bust */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, headCloud.groundY, 0]}>
        <ringGeometry args={[0.70, 0.716, 64]} />
        <meshBasicMaterial
          color="#38BDF8"
          transparent
          opacity={0.075}
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

  const pointCount = isMobile ? 8000 : 18000;

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
        camera={{ position: [0, 0.12, 3.82], fov: 34 }}
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

      {/* Subtle Bottom-Left State Indicator Synced With Overhead Beacon */}
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
