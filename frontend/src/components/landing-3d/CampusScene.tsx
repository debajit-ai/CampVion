"use client";

import React, { Component, Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
  Preload,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  BuildingId,
  CAMPUS_BUILDINGS,
  INTRO_CAMERA_POS,
  OVERVIEW_CAMERA_POS,
  OVERVIEW_CAMERA_TARGET,
  POLICY_CORE_LABEL_Y,
  SCENE_GROUP_OFFSET_Y,
  TraceStage,
} from "./campusData";
import { CampusBuildings } from "./CampusBuildings";
import { AgentOrbs } from "./AgentOrbs";
import { CAMPUS_3D_THEME } from "./theme";

type ProjectLabelCallback = (
  id: string,
  x: number,
  y: number,
  visible: boolean,
  interactive: boolean,
  viewportWidth: number,
  viewportHeight: number
) => void;

interface CampusSceneProps {
  selectedId: BuildingId | null;
  hoveredId: BuildingId | null;
  onSelect: (id: BuildingId) => void;
  onHoverChange: (id: BuildingId | null) => void;
  isNightMode: boolean;
  resetTrigger: number;
  promptSpinTrigger?: number;
  activeTraceStage?: TraceStage;
  onProjectLabel: ProjectLabelCallback;
  inView: boolean;
  reducedMotion: boolean;
  onSceneReady?: () => void;
}

const LIGHT_BG = new THREE.Color(CAMPUS_3D_THEME.light.bg);
const DARK_BG = new THREE.Color(CAMPUS_3D_THEME.dark.bg);
const LIGHT_HEMI_SKY = new THREE.Color(CAMPUS_3D_THEME.light.hemiSky);
const DARK_HEMI_SKY = new THREE.Color(CAMPUS_3D_THEME.dark.hemiSky);
const LIGHT_HEMI_GROUND = new THREE.Color(CAMPUS_3D_THEME.light.hemiGround);
const DARK_HEMI_GROUND = new THREE.Color(CAMPUS_3D_THEME.dark.hemiGround);

function EnvironmentTransition({
  isNightMode,
}: {
  isNightMode: boolean;
}) {
  const bgRef = useRef<THREE.Color>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const nightFactor = useRef(isNightMode ? 1 : 0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const alpha = 1 - Math.exp(-3.8 * dt);
    nightFactor.current = THREE.MathUtils.lerp(
      nightFactor.current,
      isNightMode ? 1 : 0,
      alpha
    );
    const n = nightFactor.current;

    if (bgRef.current) {
      bgRef.current.lerpColors(LIGHT_BG, DARK_BG, n);
    }
    if (fogRef.current) {
      fogRef.current.color.lerpColors(LIGHT_BG, DARK_BG, n);
      fogRef.current.near = THREE.MathUtils.lerp(22, 19, n);
      fogRef.current.far = THREE.MathUtils.lerp(52, 46, n);
    }
    if (hemiRef.current) {
      hemiRef.current.color.lerpColors(LIGHT_HEMI_SKY, DARK_HEMI_SKY, n);
      hemiRef.current.groundColor.lerpColors(
        LIGHT_HEMI_GROUND,
        DARK_HEMI_GROUND,
        n
      );
      hemiRef.current.intensity = THREE.MathUtils.lerp(0.85, 0.5, n);
    }
    if (dirRef.current) {
      dirRef.current.intensity = THREE.MathUtils.lerp(1.6, 2.0, n);
    }
    if (rimRef.current) {
      rimRef.current.intensity = THREE.MathUtils.lerp(0.45, 1.2, n);
    }
  });

  return (
    <>
      <color ref={bgRef} attach="background" args={[CAMPUS_3D_THEME.dark.bg]} />
      <fog ref={fogRef} attach="fog" args={[CAMPUS_3D_THEME.dark.fog, 19, 46]} />

      {/* Hemisphere Light: Sky #7DD3FC, Ground #05070F, intensity 0.5 */}
      <hemisphereLight
        ref={hemiRef}
        args={[
          CAMPUS_3D_THEME.dark.hemiSky,
          CAMPUS_3D_THEME.dark.hemiGround,
          0.5,
        ]}
      />

      {/* Front-Left Key Directional Light (Cool White, intensity 2.0) */}
      <directionalLight
        ref={dirRef}
        position={[-10, 14, 12]}
        intensity={2.0}
        color={CAMPUS_3D_THEME.dark.keyLight}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={44}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />

      {/* Behind-Right Cyan Rim Light (intensity 1.2) */}
      <directionalLight
        ref={rimRef}
        position={[11, 9, -11]}
        intensity={1.2}
        color={CAMPUS_3D_THEME.dark.rimLight}
      />

      {/* Procedural Architectural City/Studio Reflections (Zero Network HDRI Latency) */}
      <Environment
        resolution={256}
        frames={1}
        environmentIntensity={isNightMode ? 0.5 : 0.72}
      >
        <Lightformer
          form="rect"
          intensity={1.8}
          color="#E0F2FE"
          position={[-8, 6, 8]}
          scale={[10, 4, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.3}
          color="#38BDF8"
          position={[9, 4, -8]}
          scale={[10, 3, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="ring"
          intensity={1.1}
          color="#BAE6FD"
          position={[0, 12, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[12, 12, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.45}
          color="#1E293B"
          position={[0, -5, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[24, 24, 1]}
        />
      </Environment>
    </>
  );
}

function ParallaxSceneGroup({
  groupRef,
  reducedMotion,
  children,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  useFrame((state, delta) => {
    const grp = groupRef.current;
    if (!grp) return;
    if (reducedMotion) {
      grp.rotation.x = 0;
      grp.rotation.y = 0;
      return;
    }

    const dt = Math.min(delta, 0.05);
    const alpha = 1 - Math.exp(-3.4 * dt);
    const targetRotY = state.pointer.x * 0.045;
    const targetRotX = -state.pointer.y * 0.02;

    grp.rotation.y = THREE.MathUtils.lerp(grp.rotation.y, targetRotY, alpha);
    grp.rotation.x = THREE.MathUtils.lerp(grp.rotation.x, targetRotX, alpha);
  });

  return (
    <group ref={groupRef} position={[0, SCENE_GROUP_OFFSET_Y, 0]}>
      {children}
    </group>
  );
}

function LabelProjector({
  sceneGroupRef,
  onProjectLabel,
  selectedId,
  hoveredId,
}: {
  sceneGroupRef: React.RefObject<THREE.Group | null>;
  onProjectLabel: ProjectLabelCallback;
  selectedId: BuildingId | null;
  hoveredId: BuildingId | null;
}) {
  const { camera, size } = useThree();
  const vec = useRef(new THREE.Vector3());
  const lifts = useRef<number[]>(CAMPUS_BUILDINGS.map(() => 0));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const alpha = 1 - Math.exp(-8 * dt);
    const matrixWorld = sceneGroupRef.current?.matrixWorld;

    // 1. Central Policy Core Badge
    vec.current.set(0, POLICY_CORE_LABEL_Y, 0);
    if (matrixWorld) vec.current.applyMatrix4(matrixWorld);
    vec.current.project(camera);

    const coreX = (vec.current.x * 0.5 + 0.5) * size.width;
    const coreY = (-vec.current.y * 0.5 + 0.5) * size.height;
    const coreVisible = !(
      vec.current.z > 1 ||
      coreX < 24 ||
      coreX > size.width - 24 ||
      coreY < 36 ||
      coreY > size.height - 22
    );
    onProjectLabel(
      "policy-core",
      coreX,
      coreY,
      coreVisible,
      false,
      size.width,
      size.height
    );

    // 2. Four Campus Building Badges (collision-guarded against seam/edges)
    for (let i = 0; i < CAMPUS_BUILDINGS.length; i++) {
      const b = CAMPUS_BUILDINGS[i];
      const targetLift =
        selectedId === b.id ? 0.18 : hoveredId === b.id ? 0.1 : 0;
      lifts.current[i] = THREE.MathUtils.lerp(
        lifts.current[i],
        targetLift,
        alpha
      );

      vec.current.set(b.position[0], b.labelHeight + lifts.current[i], b.position[2]);
      if (matrixWorld) vec.current.applyMatrix4(matrixWorld);
      vec.current.project(camera);

      const bx = (vec.current.x * 0.5 + 0.5) * size.width;
      const by = (-vec.current.y * 0.5 + 0.5) * size.height;
      const visible = !(
        vec.current.z > 1 ||
        bx < 24 ||
        bx > size.width - 24 ||
        by < 36 ||
        by > size.height - 22
      );
      onProjectLabel(
        b.id,
        bx,
        by,
        visible,
        true,
        size.width,
        size.height
      );
    }
  });

  return null;
}

function CameraController({
  selectedId,
  resetTrigger,
  reducedMotion,
}: {
  selectedId: BuildingId | null;
  resetTrigger: number;
  reducedMotion: boolean;
}) {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const introPlayedRef = useRef(false);

  const aspect = size.width / Math.max(size.height, 1);
  // Calibrated so courtyard disc (~6.25 radius) fills ~80% of the right zone while clearing edges
  const distFactor = Math.max(1.04, Math.min(1.48, 1.38 / Math.max(aspect, 0.74)));

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const overviewPos: [number, number, number] = [
      OVERVIEW_CAMERA_POS[0] * distFactor,
      OVERVIEW_CAMERA_POS[1] * distFactor,
      OVERVIEW_CAMERA_POS[2] * distFactor,
    ];
    let destPos = overviewPos;
    let destTarget = OVERVIEW_CAMERA_TARGET;

    if (selectedId) {
      const spec = CAMPUS_BUILDINGS.find((b) => b.id === selectedId);
      if (spec) {
        const [bx, by, bz] = spec.position;
        const [ox, oy, oz] = spec.cameraOffset;
        destPos = [
          bx * 0.55 + ox * Math.min(distFactor, 1.25),
          oy * Math.min(distFactor, 1.2),
          bz * 0.55 + oz * Math.min(distFactor, 1.25),
        ];
        destTarget = [bx * 0.5, by + 0.75, bz * 0.5];
      }
    }

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    if (reducedMotion) {
      introPlayedRef.current = true;
      camera.position.set(destPos[0], destPos[1], destPos[2]);
      controls.target.set(destTarget[0], destTarget[1], destTarget[2]);
      controls.update();
      return;
    }

    const isIntro = !introPlayedRef.current && !selectedId && resetTrigger === 0;
    if (isIntro) {
      introPlayedRef.current = true;
      camera.position.set(
        INTRO_CAMERA_POS[0] * distFactor,
        INTRO_CAMERA_POS[1] * distFactor,
        INTRO_CAMERA_POS[2] * distFactor
      );
      controls.target.set(...OVERVIEW_CAMERA_TARGET);
      controls.update();

      gsap.to(camera.position, {
        x: destPos[0],
        y: destPos[1],
        z: destPos[2],
        duration: 1.8,
        ease: "power3.out",
        onUpdate: () => {
          controls.update();
        },
      });
    } else {
      introPlayedRef.current = true;
      gsap.to(camera.position, {
        x: destPos[0],
        y: destPos[1],
        z: destPos[2],
        duration: 1.15,
        ease: "power3.inOut",
        onUpdate: () => {
          controls.update();
        },
      });

      gsap.to(controls.target, {
        x: destTarget[0],
        y: destTarget[1],
        z: destTarget[2],
        duration: 1.15,
        ease: "power3.inOut",
        onUpdate: () => {
          controls.update();
        },
      });
    }

    return () => {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(controls.target);
    };
  }, [selectedId, resetTrigger, camera, reducedMotion, distFactor]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={false}
      enablePan={false}
      enableDamping
      dampingFactor={0.05}
      minPolarAngle={Math.PI / 5.5}
      maxPolarAngle={Math.PI / 2.55}
      onStart={() => {
        gsap.killTweensOf(camera.position);
        if (controlsRef.current) {
          gsap.killTweensOf(controlsRef.current.target);
        }
      }}
    />
  );
}

class WebGLErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function SceneReadySignal({ onSceneReady }: { onSceneReady?: () => void }) {
  useEffect(() => {
    if (!onSceneReady) return;
    let cancelled = false;
    const rafId = window.requestAnimationFrame(() => {
      if (!cancelled) onSceneReady();
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [onSceneReady]);

  return null;
}

function SceneFallback({ isNightMode }: { isNightMode: boolean }) {
  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center p-6 text-center transition-colors ${
        isNightMode
          ? "bg-[#05070F] text-[#F5F7FF]"
          : "bg-[#F6F7FB] text-[#0F172A]"
      }`}
    >
      <div
        className={`h-12 w-12 rounded-2xl border flex items-center justify-center mb-3 ${
          isNightMode
            ? "border-white/10 bg-[#0B1020]"
            : "border-sky-200 bg-sky-50"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full animate-pulse ${
            isNightMode ? "bg-[#38BDF8]" : "bg-[#0284C7]"
          }`}
        />
      </div>
      <p
        className={`text-xs font-mono font-bold uppercase tracking-wider ${
          isNightMode ? "text-[#38BDF8]" : "text-[#0E7490]"
        }`}
      >
        CampVion 3D Campus Simulation
      </p>
      <p
        className={`text-xs mt-1 max-w-xs ${
          isNightMode ? "text-[#C3CCE0]" : "text-slate-600"
        }`}
      >
        Interactive architectural overview ready. Select a command preset below
        to inspect domain routing.
      </p>
    </div>
  );
}

export function CampusScene({
  selectedId,
  hoveredId,
  onSelect,
  onHoverChange,
  isNightMode,
  resetTrigger,
  promptSpinTrigger = 0,
  activeTraceStage = "idle",
  onProjectLabel,
  inView,
  reducedMotion,
  onSceneReady,
}: CampusSceneProps) {
  const sceneGroupRef = useRef<THREE.Group | null>(null);

  const [webglSupported] = useState(() => {
    if (typeof document === "undefined") return true;
    try {
      const canvas = document.createElement("canvas");
      return Boolean(
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
      );
    } catch {
      return false;
    }
  });

  const [isMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });

  useEffect(() => {
    if (!webglSupported) {
      onSceneReady?.();
    }
  }, [webglSupported, onSceneReady]);

  if (!webglSupported) {
    return <SceneFallback isNightMode={isNightMode} />;
  }

  return (
    <WebGLErrorBoundary fallback={<SceneFallback isNightMode={isNightMode} />}>
      <Suspense fallback={<SceneFallback isNightMode={isNightMode} />}>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          frameloop={inView ? "always" : "never"}
          camera={{
            position: reducedMotion ? OVERVIEW_CAMERA_POS : INTRO_CAMERA_POS,
            fov: 34,
            near: 0.1,
            far: 120,
          }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          className="w-full h-full block"
        >
          <Preload all />
          <SceneReadySignal onSceneReady={onSceneReady} />
          <EnvironmentTransition isNightMode={isNightMode} />

          <ParallaxSceneGroup
            groupRef={sceneGroupRef}
            reducedMotion={reducedMotion}
          >
            <ContactShadows
              position={[0, -0.01, 0]}
              opacity={isNightMode ? 0.36 : 0.22}
              scale={15}
              blur={2.4}
              far={4.5}
              resolution={256}
              frames={1}
              color={CAMPUS_3D_THEME.dark.shadow}
            />
            <CampusBuildings
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={onSelect}
              onHoverChange={onHoverChange}
              isNightMode={isNightMode}
              inView={inView}
              reducedMotion={reducedMotion}
              promptSpinTrigger={promptSpinTrigger}
              activeTraceStage={activeTraceStage}
            />
            <AgentOrbs
              selectedId={selectedId}
              hoveredId={hoveredId}
              isNightMode={isNightMode}
            />
          </ParallaxSceneGroup>

          <CameraController
            selectedId={selectedId}
            resetTrigger={resetTrigger}
            reducedMotion={reducedMotion}
          />
          <LabelProjector
            sceneGroupRef={sceneGroupRef}
            onProjectLabel={onProjectLabel}
            selectedId={selectedId}
            hoveredId={hoveredId}
          />

          {!reducedMotion && !isMobile && isNightMode && (
            <EffectComposer multisampling={0}>
              <Bloom
                mipmapBlur
                luminanceThreshold={0.9}
                intensity={0.34}
                radius={0.42}
              />
            </EffectComposer>
          )}
        </Canvas>
      </Suspense>
    </WebGLErrorBoundary>
  );
}
