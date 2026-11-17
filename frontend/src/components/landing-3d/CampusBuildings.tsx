"use client";

import React, { useRef, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { Logo3D } from "../brand/Logo3D";
import {
  BuildingId,
  CAMPUS_BUILDINGS,
  CampusBuildingSpec,
  TraceStage,
} from "./campusData";
import {
  ACCENT_3D,
  ACCENT_3D_LIGHT,
  ACCENT_3D_WHITE,
  CAMPUS_3D_THEME,
} from "./theme";

interface CampusBuildingsProps {
  selectedId: BuildingId | null;
  hoveredId: BuildingId | null;
  onSelect: (id: BuildingId) => void;
  onHoverChange: (id: BuildingId | null) => void;
  isNightMode: boolean;
  inView?: boolean;
  reducedMotion?: boolean;
  promptSpinTrigger?: number;
  activeTraceStage?: TraceStage;
}

interface BuildingMeshProps {
  spec: CampusBuildingSpec;
  introIndex: number;
  isSelected: boolean;
  isHovered: boolean;
  isNightMode: boolean;
  reducedMotion: boolean;
  windowMap: THREE.CanvasTexture | null;
  onHoverChange: (id: BuildingId | null) => void;
  onSelect: (id: BuildingId) => void;
}

const LIGHT_WALL_COLOR = new THREE.Color(CAMPUS_3D_THEME.light.wall);
const DARK_WALL_COLOR = new THREE.Color(CAMPUS_3D_THEME.dark.wall);
const LIGHT_PLINTH_COLOR = new THREE.Color(CAMPUS_3D_THEME.light.trim);
const DARK_PLINTH_COLOR = new THREE.Color(CAMPUS_3D_THEME.dark.trim);

/**
 * Generates a procedural emissive facade window grid texture:
 * crisp dark mullions dividing glazed cells, with ~15% lit warm white (#FFE9B8)
 * and the remainder deep dark blue-slate (#0C1626 / near black emissive).
 */
function createWindowEmissiveMap(
  cols: number,
  rows: number,
  seed: number
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#040811";
  ctx.fillRect(0, 0, 512, 512);

  const cellW = 512 / cols;
  const cellH = 512 / rows;
  const padX = Math.max(4, cellW * 0.16);
  const padY = Math.max(4, cellH * 0.22);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Deterministic pseudo-random distribution (~15% lit rooms)
      const hash = ((c * 37 + r * 91 + seed * 53) % 100) / 100;
      const isLit = hash < 0.165;

      const x = c * cellW + padX;
      const y = r * cellH + padY;
      const w = cellW - padX * 2;
      const h = cellH - padY * 2;

      if (isLit) {
        const toneBucket = (c * 13 + r * 29 + seed) % 5;
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        if (toneBucket <= 1) {
          grad.addColorStop(0, "#FFF2D6");
          grad.addColorStop(1, "#FFE4B5");
        } else if (toneBucket <= 3) {
          grad.addColorStop(0, "#FFE9B8");
          grad.addColorStop(1, "#F5D08A");
        } else {
          grad.addColorStop(0, "#FDE3A7");
          grad.addColorStop(1, "#F2BE72");
        }
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = "#08101C";
      }
      ctx.fillRect(x, y, w, h);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createRadialFloorTexture(isNightMode: boolean): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
  if (isNightMode) {
    grad.addColorStop(0, "#10203A");
    grad.addColorStop(0.55, "#0C1428");
    grad.addColorStop(1, "#0A1020");
  } else {
    grad.addColorStop(0, "#F1F5F9");
    grad.addColorStop(1, "#E2E8F0");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createCoreSoftGlowTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(128, 128, 2, 128, 128, 128);
  grad.addColorStop(0, "rgba(56, 189, 248, 0.95)");
  grad.addColorStop(0.45, "rgba(56, 189, 248, 0.35)");
  grad.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createVolumetricBeamTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, "rgba(56, 189, 248, 0.92)");
  grad.addColorStop(0.28, "rgba(56, 189, 248, 0.36)");
  grad.addColorStop(0.68, "rgba(56, 189, 248, 0.08)");
  grad.addColorStop(0.92, "rgba(56, 189, 248, 0)");
  grad.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function FaintDistanceGrid({ isNightMode }: { isNightMode: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(ACCENT_3D) },
      uOpacity: { value: 0.06 },
      uScale: { value: 1.05 },
      uFadeDistance: { value: 14.0 },
      uFadeStrength: { value: 2.0 },
    }),
    []
  );

  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uColor.value.set(isNightMode ? ACCENT_3D : "#334155");
    mat.uniforms.uOpacity.value = isNightMode ? 0.06 : 0.065;
  }, [isNightMode]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
      <planeGeometry args={[32, 32]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vWorldPos;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uScale;
          uniform float uFadeDistance;
          uniform float uFadeStrength;
          varying vec3 vWorldPos;
          void main() {
            vec2 coord = vWorldPos.xz / uScale;
            vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
            float line = min(grid.x, grid.y);
            float lineMask = 1.0 - min(line, 1.0);
            float dist = length(vWorldPos.xz);
            float d = max(0.0, 1.0 - min(dist / uFadeDistance, 1.0));
            float fade = pow(d, uFadeStrength);
            float alpha = lineMask * fade * uOpacity;
            if (alpha < 0.002) discard;
            gl_FragColor = vec4(uColor, alpha);
          }
        `}
      />
    </mesh>
  );
}

function BuildingStructure({
  spec,
  introIndex,
  isSelected,
  isHovered,
  isNightMode,
  reducedMotion,
  windowMap,
  onHoverChange,
  onSelect,
}: BuildingMeshProps) {
  const rootRef = useRef<THREE.Group>(null);
  const introGroupRef = useRef<THREE.Group>(null);
  const liftGroupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const nightBlendRef = useRef(isNightMode ? 1 : 0);
  const introElapsedRef = useRef(reducedMotion ? 5 : 0);

  const topEdgeOpacity = isSelected ? 0.65 : isHovered ? 0.48 : 0.35;
  const wallColor = "#1B2433";
  const plinthColor = "#232E42";
  const edgeColor =
    isSelected || isHovered ? ACCENT_3D_WHITE : ACCENT_3D_LIGHT;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const alpha = 1 - Math.exp(-5.5 * dt);

    if (introGroupRef.current) {
      if (reducedMotion) {
        introGroupRef.current.position.y = 0;
        introGroupRef.current.scale.setScalar(1);
      } else {
        introElapsedRef.current += dt;
        const delay = 0.16 + introIndex * 0.1;
        const rawT = Math.max(
          0,
          Math.min(1, (introElapsedRef.current - delay) / 0.85)
        );
        const eased = 1 - Math.pow(1 - rawT, 3);
        introGroupRef.current.position.y = THREE.MathUtils.lerp(-1.05, 0, eased);
        introGroupRef.current.scale.setScalar(
          THREE.MathUtils.lerp(0.88, 1, eased)
        );
      }
    }

    if (liftGroupRef.current) {
      const targetY = isSelected ? 0.16 : isHovered ? 0.09 : 0;
      liftGroupRef.current.position.y = THREE.MathUtils.lerp(
        liftGroupRef.current.position.y,
        targetY,
        1 - Math.exp(-8 * dt)
      );
    }

    if (ringRef.current) {
      const targetScale = isSelected ? 1.1 : isHovered ? 1.05 : 0.96;
      ringRef.current.scale.setScalar(
        THREE.MathUtils.lerp(
          ringRef.current.scale.x,
          targetScale,
          1 - Math.exp(-7 * dt)
        )
      );
    }

    nightBlendRef.current = THREE.MathUtils.lerp(
      nightBlendRef.current,
      isNightMode ? 1 : 0,
      alpha
    );
    const nb = nightBlendRef.current;

    if (rootRef.current) {
      rootRef.current.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mat = child.material;
        if (!(mat instanceof THREE.MeshStandardMaterial)) return;

        if (mat.name === "wall") {
          mat.color.lerpColors(LIGHT_WALL_COLOR, DARK_WALL_COLOR, nb);
        } else if (mat.name === "plinth") {
          mat.color.lerpColors(LIGHT_PLINTH_COLOR, DARK_PLINTH_COLOR, nb);
        }
      });
    }
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHoverChange(spec.id);
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHoverChange(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(spec.id);
  };

  const glassEmissive = isSelected ? 0.88 : isHovered ? 0.8 : 0.72;

  return (
    <group ref={rootRef} position={spec.position}>
      <group
        ref={introGroupRef}
        position={[0, reducedMotion ? 0 : -1.05, 0]}
        scale={reducedMotion ? 1 : 0.88}
      >
        {/* Subtle Focus Halo Only When Selected or Hovered */}
        {(isSelected || isHovered) && (
          <mesh
            ref={ringRef}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.015, 0]}
          >
            <ringGeometry args={[1.45, 1.5, 48]} />
            <meshBasicMaterial
              color={ACCENT_3D_LIGHT}
              transparent
              opacity={isSelected ? 0.45 : 0.25}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Lighter Concrete/Slate Base Plinth (#232E42) Separating From Floor */}
        <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.55, 0.16, 2.35]} />
          <meshStandardMaterial
            name="plinth"
            color={plinthColor}
            roughness={0.75}
            metalness={0.14}
          />
          <Edges
            threshold={15}
            color={edgeColor}
            transparent
            opacity={0.22}
          />
        </mesh>

        {/* Architectural Building Volume */}
        <group
          ref={liftGroupRef}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          {/* ---------------------------------------------------------------
              1. HOSTEL: Tall Residential Tower (4 Stepped Slabs + Balconies + Lit Window Grid)
             --------------------------------------------------------------- */}
          {spec.id === "hostel" && (
            <group position={[0, 0.16, 0]}>
              {/* Lower Lounge Podium Wing */}
              <mesh position={[0.42, 0.28, 0.18]} castShadow receiveShadow>
                <boxGeometry args={[1.4, 0.56, 1.48]} />
                <meshStandardMaterial name="plinth" color={plinthColor} roughness={0.7} metalness={0.15} />
                <Edges threshold={15} color={edgeColor} transparent opacity={topEdgeOpacity} />
              </mesh>
              <mesh position={[0.42, 0.28, 0.18]}>
                <boxGeometry args={[1.41, 0.44, 1.49]} />
                <meshPhysicalMaterial name="glass" color="#0C1626" roughness={0.15} metalness={0.1} envMapIntensity={0.5} emissive="#FFFFFF" emissiveMap={windowMap} emissiveIntensity={glassEmissive} />
              </mesh>

              {/* Main Residential Tower Slab Stack (3 Stacked Floors + Penthouse Core) */}
              <mesh position={[-0.36, 0.65, -0.14]} castShadow receiveShadow>
                <boxGeometry args={[1.05, 1.3, 1.25]} />
                <meshStandardMaterial name="wall" color={wallColor} roughness={0.7} metalness={0.16} />
              </mesh>
              <mesh position={[-0.36, 1.62, -0.14]} castShadow receiveShadow>
                <boxGeometry args={[0.96, 0.64, 1.15]} />
                <meshStandardMaterial name="wall" color={wallColor} roughness={0.7} metalness={0.16} />
                <Edges threshold={15} color={edgeColor} transparent opacity={topEdgeOpacity} />
              </mesh>
              {/* Rooftop Mechanical Cap */}
              <mesh position={[-0.36, 2.02, -0.14]} castShadow>
                <boxGeometry args={[0.64, 0.16, 0.72]} />
                <meshStandardMaterial name="plinth" color={plinthColor} roughness={0.72} metalness={0.18} />
                <Edges threshold={15} color={edgeColor} transparent opacity={topEdgeOpacity} />
              </mesh>

              {/* Glazed Facade Panels Around Tower */}
              <mesh position={[-0.36, 1.0, -0.14]}>
                <boxGeometry args={[1.07, 1.75, 1.27]} />
                <meshPhysicalMaterial name="glass" color="#0C1626" roughness={0.15} metalness={0.1} envMapIntensity={0.5} emissive="#FFFFFF" emissiveMap={windowMap} emissiveIntensity={glassEmissive} />
              </mesh>

              {/* Horizontal Balcony Ledges on Camera-Facing Front (+X / +Z) */}
              {[0.58, 0.98, 1.38, 1.78].map((yPos) => (
                <mesh key={yPos} position={[0.18, yPos, -0.14]} castShadow>
                  <boxGeometry args={[0.2, 0.05, 1.14]} />
                  <meshStandardMaterial name="plinth" color={plinthColor} roughness={0.68} metalness={0.2} />
                </mesh>
              ))}
            </group>
          )}

          {/* ---------------------------------------------------------------
              2. ADMIN GATE: Two Tall Pillars + Stepped Podium + Spanning Lintel
             --------------------------------------------------------------- */}
          {spec.id === "admin-gate" && (
            <group position={[0, 0.16, 0]}>
              {/* Wide Stepped Podium */}
              <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.3, 0.28, 1.65]} />
                <meshStandardMaterial name="plinth" color={plinthColor} roughness={0.74} metalness={0.14} />
                <Edges threshold={15} color={edgeColor} transparent opacity={0.28} />
              </mesh>

              {/* Left Pillar */}
              <mesh position={[-0.72, 1.2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.62, 1.88, 0.84]} />
                <meshStandardMaterial name="wall" color={wallColor} roughness={0.7} metalness={0.16} />
                <Edges threshold={15} color={edgeColor} transparent opacity={topEdgeOpacity} />
              </mesh>
              <mesh position={[-0.72, 1.2, 0]}>
                <boxGeometry args={[0.64, 1.66, 0.86]} />
                <meshPhysicalMaterial name="glass" color="#0C1626" roughness={0.15} metalness={0.1} envMapIntensity={0.5} emissive="#FFFFFF" emissiveMap={windowMap} emissiveIntensity={glassEmissive} />
              </mesh>

              {/* Right Pillar */}
              <mesh position={[0.72, 1.2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.62, 1.88, 0.84]} />
                <meshStandardMaterial name="wall" color={wallColor} roughness={0.7} metalness={0.16} />
                <Edges threshold={15} color={edgeColor} transparent opacity={topEdgeOpacity} />
              </mesh>
              <mesh position={[0.72, 1.2, 0]}>
                <boxGeometry args={[0.64, 1.66, 0.86]} />
                <meshPhysicalMaterial name="glass" color="#0C1626" roughness={0.15} metalness={0.1} envMapIntensity={0.5} emissive="#FFFFFF" emissiveMap={windowMap} emissiveIntensity={glassEmissive} />
              </mesh>

              {/* Spanning Skybridge Lintel */}
              <mesh position={[0, 2.02, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.22, 0.42, 0.94]} />
                <meshStandardMaterial name="wall" color={wallColor} roughness={0.7} metalness={0.18} />
                <Edges threshold={15} color={edgeColor} transparent opacity={topEdgeOpacity} />
              </mesh>
              <mesh position={[0, 2.02, 0]}>
                <boxGeometry args={[2.24, 0.24, 0.96]} />
                <meshPhysicalMaterial name="glass" color="#0C1626" roughness={0.15} metalness={0.1} envMapIntensity={0.5} emissive="#FFFFFF" emissiveMap={windowMap} emissiveIntensity={glassEmissive} />
              </mesh>
            </group>
          )}

          {/* ---------------------------------------------------------------
              3. LEAVE DESK: Low Service Pavilion + Flat Roof Overhang + Glass Front
             --------------------------------------------------------------- */}
          {spec.id === "leave" && (
            <group position={[0, 0.16, 0]}>
              {/* Broad Stepped Terrace */}
              <mesh position={[0, 0.08, 0.1]} castShadow receiveShadow>
                <boxGeometry args={[2.25, 0.16, 1.85]} />
                <meshStandardMaterial name="plinth" color={plinthColor} roughness={0.74} metalness={0.12} />
              </mesh>

              {/* Rear Architectural Concrete Core */}
              <mesh position={[0, 0.56, -0.32]} castShadow receiveShadow>
                <boxGeometry args={[1.9, 0.84, 0.72]} />
                <meshStandardMaterial name="wall" color={wallColor} roughness={0.7} metalness={0.16} />
              </mesh>

              {/* Illuminated Wrap-Around Glass Pavilion Front */}
              <mesh position={[0, 0.56, 0.18]} castShadow>
                <boxGeometry args={[1.82, 0.78, 0.92]} />
                <meshPhysicalMaterial name="glass" color="#0C1626" roughness={0.15} metalness={0.1} envMapIntensity={0.55} emissive="#FFFFFF" emissiveMap={windowMap} emissiveIntensity={glassEmissive} />
              </mesh>

              {/* Front Slim Steel Support Columns */}
              {[-0.86, 0, 0.86].map((xPos) => (
                <mesh key={xPos} position={[xPos, 0.58, 0.78]} castShadow>
                  <boxGeometry args={[0.08, 0.88, 0.08]} />
                  <meshStandardMaterial name="plinth" color={plinthColor} roughness={0.5} metalness={0.4} />
                </mesh>
              ))}

              {/* Cantilevered Flat Roof Overhang */}
              <mesh position={[0, 1.06, 0.06]} castShadow receiveShadow>
                <boxGeometry args={[2.22, 0.14, 1.72]} />
                <meshStandardMaterial name="wall" color={wallColor} roughness={0.7} metalness={0.18} />
                <Edges threshold={15} color={edgeColor} transparent opacity={topEdgeOpacity} />
              </mesh>
            </group>
          )}

          {/* ---------------------------------------------------------------
              4. ACADEMICS: Long Lecture Hall + Sloped Roof + Continuous Glass Facade
             --------------------------------------------------------------- */}
          {spec.id === "academics" && (
            <group position={[0, 0.16, 0]}>
              {/* Long Lecture Hall Main Body */}
              <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.85, 1.16, 2.05]} />
                <meshStandardMaterial name="wall" color={wallColor} roughness={0.7} metalness={0.16} />
              </mesh>

              {/* Continuous Glazed Curtain Wall Facade */}
              <mesh position={[0, 0.58, 0]}>
                <boxGeometry args={[1.88, 0.92, 2.08]} />
                <meshPhysicalMaterial name="glass" color="#0C1626" roughness={0.15} metalness={0.1} envMapIntensity={0.55} emissive="#FFFFFF" emissiveMap={windowMap} emissiveIntensity={glassEmissive} />
              </mesh>

              {/* Rhythmic Structural Concrete Fins Along Long Facades */}
              {[-0.78, -0.26, 0.26, 0.78].map((zOff) => (
                <mesh key={zOff} position={[-0.95, 0.62, zOff]} castShadow>
                  <boxGeometry args={[0.1, 1.24, 0.1]} />
                  <meshStandardMaterial name="plinth" color={plinthColor} roughness={0.68} metalness={0.2} />
                </mesh>
              ))}

              {/* Sloped Architectural Lecture Roof */}
              <mesh
                position={[0.04, 1.28, 0]}
                rotation={[0, 0, -0.14]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[2.06, 0.16, 2.18]} />
                <meshStandardMaterial name="plinth" color={plinthColor} roughness={0.7} metalness={0.2} />
                <Edges threshold={15} color={edgeColor} transparent opacity={topEdgeOpacity} />
              </mesh>
            </group>
          )}
        </group>
      </group>
    </group>
  );
}

const LOGO_FLOAT_Y = 2.2;
const LOGO_TARGET_WIDTH = 2.7;

export function CampusBuildings({
  selectedId,
  hoveredId,
  onSelect,
  onHoverChange,
  isNightMode,
  inView = true,
  reducedMotion = false,
  promptSpinTrigger = 0,
  activeTraceStage = "idle",
}: CampusBuildingsProps) {
  const coreGroupRef = useRef<THREE.Group>(null);
  const coreIntroRef = useRef(reducedMotion ? 5 : 0);
  const [isCoreHovered, setIsCoreHovered] = useState(false);

  const modePalette = isNightMode ? CAMPUS_3D_THEME.dark : CAMPUS_3D_THEME.light;

  const {
    windowMapLarge,
    windowMapWide,
    floorMapDark,
    floorMapLight,
    coreGlowTex,
    beamTex,
  } = useMemo(
    () => ({
      windowMapLarge: createWindowEmissiveMap(8, 10, 11),
      windowMapWide: createWindowEmissiveMap(10, 4, 29),
      floorMapDark: createRadialFloorTexture(true),
      floorMapLight: createRadialFloorTexture(false),
      coreGlowTex: createCoreSoftGlowTexture(),
      beamTex: createVolumetricBeamTexture(),
    }),
    []
  );

  useEffect(() => {
    return () => {
      windowMapLarge?.dispose();
      windowMapWide?.dispose();
      floorMapDark?.dispose();
      floorMapLight?.dispose();
      coreGlowTex?.dispose();
      beamTex?.dispose();
    };
  }, [
    windowMapLarge,
    windowMapWide,
    floorMapDark,
    floorMapLight,
    coreGlowTex,
    beamTex,
  ]);

  useEffect(() => {
    document.body.style.cursor = hoveredId || isCoreHovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hoveredId, isCoreHovered]);

  useFrame((_, delta) => {
    if (!inView) return;
    const dt = Math.min(delta, 0.05);

    if (coreGroupRef.current) {
      if (!reducedMotion) {
        coreIntroRef.current += dt;
        const coreRawT = Math.max(
          0,
          Math.min(1, (coreIntroRef.current - 0.06) / 0.85)
        );
        const coreEased = 1 - Math.pow(1 - coreRawT, 3);
        coreGroupRef.current.position.y = THREE.MathUtils.lerp(
          -1.0,
          0,
          coreEased
        );
        coreGroupRef.current.scale.setScalar(
          THREE.MathUtils.lerp(0.84, 1, coreEased)
        );
      } else {
        coreGroupRef.current.position.y = 0;
        coreGroupRef.current.scale.setScalar(1);
      }
    }
  });

  const activeFloorMap = isNightMode ? floorMapDark : floorMapLight;

  return (
    <group>
      {/* Floor Disc (#0A1020 -> subtle #10203A center gradient, roughness 0.8) */}
      <mesh
        position={[0, -0.14, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <cylinderGeometry args={[6.25, 6.4, 0.24, 64]} />
        <meshStandardMaterial
          map={activeFloorMap}
          color="#FFFFFF"
          roughness={0.8}
          metalness={0.08}
        />
        <Edges
          threshold={15}
          color={ACCENT_3D}
          transparent
          opacity={isNightMode ? 0.14 : 0.18}
        />
      </mesh>

      {/* Very Faint Grid (opacity <= 0.06, fadeDistance 14, fadeStrength 2) */}
      <FaintDistanceGrid isNightMode={isNightMode} />

      {/* Soft Cyan Glow Strictly Directly Under Policy Core (radius ~2.0, opacity 0.25) */}
      {coreGlowTex && isNightMode && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[4.0, 4.0]} />
          <meshBasicMaterial
            map={coreGlowTex}
            transparent
            opacity={0.25}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Single Cyan Ring Around Core */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[1.64, 1.67, 72]} />
        <meshBasicMaterial
          color={ACCENT_3D}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Enlarged (~1.6x) Central Policy Core Focal Point */}
      <group ref={coreGroupRef} position={[0, 0, 0]}>
        <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.1, 1.26, 0.24, 36]} />
          <meshStandardMaterial
            color={modePalette.coreBody}
            roughness={0.78}
            metalness={0.14}
          />
          <Edges
            threshold={15}
            color={ACCENT_3D_LIGHT}
            transparent
            opacity={0.35}
          />
        </mesh>

        {/* Extruded 3D CampVion Shield Logo Policy Core (Shared Logo3D Component) */}
        <Logo3D
          inView={inView}
          reducedMotion={reducedMotion}
          promptSpinTrigger={promptSpinTrigger}
          activeStage={activeTraceStage}
          isDarkSurface={true}
          targetWidth={LOGO_TARGET_WIDTH}
          baseY={LOGO_FLOAT_Y}
          isHovered={isCoreHovered}
          onHoverChange={setIsCoreHovered}
        />

        {/* Narrow Tapered Volumetric Light Beam (fades smoothly to 0 before top edge) */}
        {beamTex && isNightMode && (
          <mesh position={[0, 2.02, 0]}>
            <cylinderGeometry args={[0.62, 1.25, 3.6, 36, 1, true]} />
            <meshBasicMaterial
              map={beamTex}
              color={ACCENT_3D}
              transparent
              opacity={0.09}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>

      {/* 4 Architectural Campus Buildings */}
      {CAMPUS_BUILDINGS.map((spec, idx) => {
        const winMap =
          spec.id === "hostel" || spec.id === "admin-gate"
            ? windowMapLarge
            : windowMapWide;
        return (
          <BuildingStructure
            key={spec.id}
            spec={spec}
            introIndex={idx}
            isSelected={selectedId === spec.id}
            isHovered={hoveredId === spec.id}
            isNightMode={isNightMode}
            reducedMotion={reducedMotion}
            windowMap={winMap}
            onHoverChange={onHoverChange}
            onSelect={onSelect}
          />
        );
      })}
    </group>
  );
}
