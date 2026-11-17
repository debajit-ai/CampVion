"use client";

import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { BuildingId, CAMPUS_BUILDINGS } from "./campusData";
import { ACCENT_3D, ACCENT_3D_LIGHT, ACCENT_3D_WHITE, CAMPUS_3D_THEME } from "./theme";

interface AgentOrbsProps {
  selectedId: BuildingId | null;
  hoveredId: BuildingId | null;
  isNightMode: boolean;
}

const TRAIL_PER_ORB = 12;
const ORB_COUNT = 3;
const TOTAL_TRAIL_INSTANCES = ORB_COUNT * TRAIL_PER_ORB;
const DUST_COUNT = 28;
const SPLINE_PULSE_COUNT = CAMPUS_BUILDINGS.length;

function createSplineCurve(endPos: [number, number, number]) {
  const start = new THREE.Vector3(0, 0.38, 0);
  const mid = new THREE.Vector3(endPos[0] * 0.46, 1.48, endPos[2] * 0.46);
  const end = new THREE.Vector3(endPos[0] * 0.85, 1.05, endPos[2] * 0.85);
  return new THREE.CatmullRomCurve3([start, mid, end]);
}

function ConnectionLine({
  endPos,
  isActive,
  isSecondaryPath,
}: {
  endPos: [number, number, number];
  isActive: boolean;
  isSecondaryPath: boolean;
}) {
  const linePoints = useMemo(() => {
    const curve = createSplineCurve(endPos);
    return curve.getPoints(36).map((v) => [v.x, v.y, v.z] as [number, number, number]);
  }, [endPos]);

  const opacity = isActive ? 0.9 : isSecondaryPath ? 0.65 : 0.5;

  return (
    <Line
      points={linePoints}
      color={isActive ? ACCENT_3D_LIGHT : ACCENT_3D}
      lineWidth={isActive ? 1.5 : 1.05}
      transparent
      opacity={opacity}
    />
  );
}

export function AgentOrbs({
  selectedId,
  hoveredId,
  isNightMode,
}: AgentOrbsProps) {
  const focusId = selectedId || hoveredId;
  const palette = isNightMode ? CAMPUS_3D_THEME.dark : CAMPUS_3D_THEME.light;

  const orbRefs = useRef<(THREE.Group | null)[]>([null, null, null]);
  const trailMeshRef = useRef<THREE.InstancedMesh>(null);
  const pulseMeshRef = useRef<THREE.InstancedMesh>(null);
  const dustMeshRef = useRef<THREE.InstancedMesh>(null);

  const progressRefs = useRef<number[]>([0.05, 0.38, 0.72]);
  const speedRefs = useRef<number[]>([0.13, 0.12, 0.11]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);

  const glowSpriteTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.28, "rgba(255, 255, 255, 0.45)");
    grad.addColorStop(0.65, "rgba(255, 255, 255, 0.08)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => {
    return () => {
      glowSpriteTex?.dispose();
    };
  }, [glowSpriteTex]);

  const agentCurves = useMemo(() => {
    const c1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.05, 3.6),
      new THREE.Vector3(0, 2.25, 1.85),
      new THREE.Vector3(0, 1.38, 0),
      new THREE.Vector3(0, 2.25, -1.85),
      new THREE.Vector3(0, 1.05, -3.6),
    ]);

    const c2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(3.6, 1.05, 0),
      new THREE.Vector3(1.85, 2.25, 0),
      new THREE.Vector3(0, 1.38, 0),
      new THREE.Vector3(0, 2.25, 1.85),
      new THREE.Vector3(0, 1.05, 3.6),
    ]);

    const c3 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.6, 1.05, 0),
      new THREE.Vector3(-1.85, 2.25, 0),
      new THREE.Vector3(0, 1.38, 0),
      new THREE.Vector3(0, 2.25, -1.85),
      new THREE.Vector3(0, 1.05, -3.6),
    ]);

    return [c1, c2, c3];
  }, []);

  const splineCurves = useMemo(
    () =>
      CAMPUS_BUILDINGS.map((b) => ({
        id: b.id,
        curve: createSplineCurve(b.position),
      })),
    []
  );

  const dustSeeds = useMemo(() => {
    const arr: { angle: number; radius: number; height: number; speed: number }[] =
      [];
    for (let i = 0; i < DUST_COUNT; i++) {
      arr.push({
        angle: (i / DUST_COUNT) * Math.PI * 2,
        radius: 1.8 + ((i * 1.63) % 7.2),
        height: 0.25 + ((i * 0.79) % 2.9),
        speed: 0.05 + ((i * 0.04) % 0.1),
      });
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;
    const targetSpeed = focusId ? 0.22 : 0.12;

    for (let o = 0; o < ORB_COUNT; o++) {
      speedRefs.current[o] = THREE.MathUtils.lerp(
        speedRefs.current[o],
        targetSpeed * (1 + o * 0.06),
        1 - Math.exp(-4 * dt)
      );
      progressRefs.current[o] =
        (progressRefs.current[o] + speedRefs.current[o] * dt) % 1;

      const t = progressRefs.current[o];
      const curve = agentCurves[o];
      curve.getPointAt(t, tempPos);

      const orbGroup = orbRefs.current[o];
      if (orbGroup) {
        orbGroup.position.copy(tempPos);
      }

      if (trailMeshRef.current) {
        for (let s = 0; s < TRAIL_PER_ORB; s++) {
          const instanceIndex = o * TRAIL_PER_ORB + s;
          const trailT = t - (s + 1) * 0.012;
          if (trailT < 0) {
            dummy.scale.setScalar(0);
            dummy.updateMatrix();
            trailMeshRef.current.setMatrixAt(instanceIndex, dummy.matrix);
          } else {
            curve.getPointAt(trailT, tempPos);
            dummy.position.copy(tempPos);
            const falloff = 1 - s / TRAIL_PER_ORB;
            const radiusScale = 0.042 * falloff;
            dummy.scale.setScalar(radiusScale);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            trailMeshRef.current.setMatrixAt(instanceIndex, dummy.matrix);
          }
        }
      }
    }

    if (trailMeshRef.current) {
      trailMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (pulseMeshRef.current) {
      for (let i = 0; i < SPLINE_PULSE_COUNT; i++) {
        const sc = splineCurves[i];
        const pulseT = (elapsed * 0.2 + i * 0.25) % 1;
        sc.curve.getPointAt(pulseT, tempPos);
        dummy.position.copy(tempPos);
        const pulseScale = focusId === sc.id ? 0.048 : 0.032;
        dummy.scale.setScalar(pulseScale);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pulseMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      pulseMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (dustMeshRef.current) {
      for (let i = 0; i < DUST_COUNT; i++) {
        const seed = dustSeeds[i];
        const a = seed.angle + elapsed * seed.speed * 0.25;
        dummy.position.set(
          Math.cos(a) * seed.radius,
          seed.height + Math.sin(elapsed * 0.8 + i) * 0.12,
          Math.sin(a) * seed.radius
        );
        dummy.scale.setScalar(isNightMode ? 0.022 : 0.018);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        dustMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      dustMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const secondaryHighlightId: BuildingId | null =
    focusId === "leave" || focusId === "hostel"
      ? "admin-gate"
      : focusId === "academics"
      ? "leave"
      : null;

  return (
    <group>
      {/* Thin (1px) Crisp Cyan Connection Lines (opacity 0.5) */}
      {CAMPUS_BUILDINGS.map((b) => (
        <ConnectionLine
          key={b.id}
          endPos={b.position}
          isActive={focusId === b.id}
          isSecondaryPath={secondaryHighlightId === b.id}
        />
      ))}

      {/* 3 Restrained Cyan Agent Orbs */}
      {[0, 1, 2].map((idx) => (
        <group
          key={idx}
          ref={(el) => {
            orbRefs.current[idx] = el;
          }}
        >
          <mesh>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial
              color={idx === 0 ? ACCENT_3D_WHITE : ACCENT_3D}
              emissive={ACCENT_3D}
              emissiveIntensity={0.65}
              roughness={0.15}
            />
          </mesh>
          {glowSpriteTex && (
            <sprite scale={[0.38, 0.38, 0.38]}>
              <spriteMaterial
                map={glowSpriteTex}
                color={ACCENT_3D}
                transparent
                opacity={isNightMode ? 0.34 : 0.18}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </sprite>
          )}
        </group>
      ))}

      {/* Instanced Soft Tapered Trails */}
      <instancedMesh
        ref={trailMeshRef}
        args={[undefined, undefined, TOTAL_TRAIL_INSTANCES]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={ACCENT_3D}
          transparent
          opacity={isNightMode ? 0.38 : 0.3}
        />
      </instancedMesh>

      {/* Instanced Small Data Pulses Along Splines */}
      <instancedMesh
        ref={pulseMeshRef}
        args={[undefined, undefined, SPLINE_PULSE_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={ACCENT_3D_WHITE}
          transparent
          opacity={isNightMode ? 0.45 : 0.4}
        />
      </instancedMesh>

      {/* Subtle Ambient Dust */}
      <instancedMesh
        ref={dustMeshRef}
        args={[undefined, undefined, DUST_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={palette.dust}
          transparent
          opacity={isNightMode ? 0.28 : 0.2}
        />
      </instancedMesh>
    </group>
  );
}
