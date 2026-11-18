"use client";

import React, { Component, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { TraceStage } from "../landing-3d/campusData";

export type Logo3DState =
  | TraceStage
  | "thinking"
  | "waiting_for_approval"
  | "completed"
  | "failed";

interface BuiltSvgPart {
  id: string;
  zOffset: number;
  isDiamond: boolean;
  baseOpacity: number;
  geometry: THREE.ExtrudeGeometry;
  material: THREE.Material;
  edgesGeometry: THREE.EdgesGeometry;
  edgeMaterial: THREE.LineBasicMaterial;
}

const STAGE_COLORS: Record<string, { diamond: string; edge: string; pulseSpeed: number }> = {
  idle: { diamond: "#A78BFA", edge: "#7DD3FC", pulseSpeed: 2.0 },
  parsing: { diamond: "#38BDF8", edge: "#38BDF8", pulseSpeed: 3.4 },
  thinking: { diamond: "#38BDF8", edge: "#22D3EE", pulseSpeed: 4.0 },
  policy: { diamond: "#34D399", edge: "#34D399", pulseSpeed: 2.6 },
  completed: { diamond: "#34D399", edge: "#34D399", pulseSpeed: 2.8 },
  approval: { diamond: "#FBBF24", edge: "#FBBF24", pulseSpeed: 4.2 },
  waiting_for_approval: { diamond: "#FBBF24", edge: "#FBBF24", pulseSpeed: 4.2 },
  executed: { diamond: "#E0F2FE", edge: "#E0F2FE", pulseSpeed: 2.0 },
  failed: { diamond: "#F87171", edge: "#F87171", pulseSpeed: 3.2 },
};

let cachedSvgTextPromise: Promise<string> | null = null;

function loadCampVionMarkSvg(): Promise<string> {
  if (!cachedSvgTextPromise) {
    cachedSvgTextPromise = fetch("/brand/campvion-mark-white.svg").then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    });
  }
  return cachedSvgTextPromise;
}

export class Logo3DErrorBoundary extends Component<
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

export function Logo3DFallbackPlane({
  reducedMotion = false,
  inView = true,
  baseY = 0,
  targetWidth = 2.7,
}: {
  reducedMotion?: boolean;
  inView?: boolean;
  baseY?: number;
  targetWidth?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const height = targetWidth * (928 / 684);

  useEffect(() => {
    let active = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      "/brand/campvion-mark-white.svg",
      (tex) => {
        if (!active) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        setTexture(tex);
      },
      undefined,
      () => {
        // Keep crystal octahedron silhouette if texture fails
      }
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  useFrame((state) => {
    if (!inView || reducedMotion || !meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.position.y = baseY + Math.sin(t * 0.8) * 0.06;
    meshRef.current.rotation.y = Math.sin(t * 0.35) * 0.45;
  });

  return (
    <mesh ref={meshRef} position={[0, baseY, 0]}>
      <planeGeometry args={[targetWidth, height]} />
      {texture ? (
        <meshBasicMaterial
          map={texture}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      ) : (
        <meshStandardMaterial
          color="#8B5CF6"
          emissive="#A78BFA"
          emissiveIntensity={0.45}
          side={THREE.DoubleSide}
        />
      )}
    </mesh>
  );
}

export interface Logo3DProps {
  inView?: boolean;
  reducedMotion?: boolean;
  promptSpinTrigger?: number;
  activeStage?: Logo3DState;
  isDarkSurface?: boolean;
  targetWidth?: number;
  baseY?: number;
  baseZ?: number;
  floatAmplitude?: number;
  castShadow?: boolean;
  isHovered?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  /** Supports entrance intro fade-in and scatter exit scale-down (to 0.6) + fade-out */
  visibilityPhase?: "enter" | "idle" | "exit";
  /** Optional shared pointer override in normalized [-1, 1] coordinates */
  pointerOverrideRef?: React.RefObject<{ x: number; y: number }>;
  onReady?: () => void;
}

export function Logo3DMesh({
  inView = true,
  reducedMotion = false,
  promptSpinTrigger = 0,
  activeStage = "idle",
  isDarkSurface = true,
  targetWidth = 2.7,
  baseY = 2.2,
  baseZ = 0,
  floatAmplitude = 0.06,
  castShadow = true,
  isHovered = false,
  onHoverChange,
  visibilityPhase = "idle",
  pointerOverrideRef,
  onReady,
}: Logo3DProps) {
  const pivotRef = useRef<THREE.Group>(null);
  const [parts, setParts] = useState<BuiltSvgPart[] | null>(null);
  const [svgFailed, setSvgFailed] = useState(false);

  const sweepPhaseRef = useRef(0);
  const hoverScaleRef = useRef(1);
  const entranceScaleRef = useRef(visibilityPhase === "enter" && !reducedMotion ? 0.86 : 1);
  const opacityRef = useRef(visibilityPhase === "enter" && !reducedMotion ? 0 : 1);
  const tiltRef = useRef({ x: 0, y: 0 });
  const spinStateRef = useRef({ y: 0 });
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);
  const onReadyCalledRef = useRef(false);

  const diamondTargetRef = useRef(new THREE.Color(STAGE_COLORS.idle.diamond));
  const diamondFromRef = useRef(new THREE.Color(STAGE_COLORS.idle.diamond));
  const diamondCurrentRef = useRef(new THREE.Color(STAGE_COLORS.idle.diamond));
  const edgeTargetRef = useRef(new THREE.Color(STAGE_COLORS.idle.edge));
  const edgeFromRef = useRef(new THREE.Color(STAGE_COLORS.idle.edge));
  const edgeCurrentRef = useRef(new THREE.Color(STAGE_COLORS.idle.edge));
  const traceBlendRef = useRef(1);

  useEffect(() => {
    let mounted = true;
    let builtList: BuiltSvgPart[] = [];

    loadCampVionMarkSvg()
      .then((svgText) => {
        if (!mounted) return;
        const loader = new SVGLoader();
        const parsed = loader.parse(svgText);
        if (!parsed.paths.length) throw new Error("Empty SVG paths");

        const svgEl = parsed.xml;
        const vb = svgEl?.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
        const vbW = vb && vb.length === 4 && vb[2] > 0 ? vb[2] : 684;
        const vbH = vb && vb.length === 4 && vb[3] > 0 ? vb[3] : 928;
        const cx = vbW / 2;
        const cy = vbH / 2;
        const scale = targetWidth / vbW;

        const nextParts: BuiltSvgPart[] = [];
        let partCounter = 0;

        for (const shapePath of parsed.paths) {
          const pathStyle = (
            shapePath.userData as { style?: { fill?: string } } | undefined
          )?.style;
          const rawFill =
            pathStyle?.fill ||
            (shapePath.color ? `#${shapePath.color.getHexString()}` : "");
          const fillHex = rawFill.toUpperCase();

          let material: THREE.Material;
          let zOffset = 0;
          let isDiamond = false;

          if (fillHex === "#A78BFA") {
            isDiamond = true;
            zOffset = 0.012;
            material = new THREE.MeshStandardMaterial({
              name: "core-diamond",
              color: "#C4B5FD",
              emissive: "#A78BFA",
              emissiveIntensity: 1.2,
              metalness: 0.25,
              roughness: 0.18,
              transparent: true,
              opacity: 1,
            });
          } else if (fillHex === "#8B5CF6") {
            zOffset = 0.025;
            material = new THREE.MeshStandardMaterial({
              color: isDarkSurface ? "#7C3AED" : "#6D28D9",
              emissive: isDarkSurface ? "#8B5CF6" : "#4F46E5",
              emissiveIntensity: isDarkSurface ? 0.35 : 0.22,
              metalness: 0.5,
              roughness: 0.3,
              transparent: true,
              opacity: 1,
            });
          } else if (fillHex === "#C7D0E6") {
            zOffset = 0;
            material = new THREE.MeshPhysicalMaterial({
              color: isDarkSurface ? "#AEB9D1" : "#1E293B",
              metalness: isDarkSurface ? 0.85 : 0.72,
              roughness: 0.22,
              clearcoat: 0.6,
              transparent: true,
              opacity: 1,
            });
          } else {
            zOffset = 0;
            material = new THREE.MeshPhysicalMaterial({
              color: isDarkSurface ? "#DDE6F5" : "#0F172A",
              metalness: isDarkSurface ? 0.85 : 0.68,
              roughness: 0.22,
              clearcoat: 0.6,
              transparent: true,
              opacity: 1,
            });
          }

          const shapes = SVGLoader.createShapes(shapePath);
          for (const shape of shapes) {
            const pts2 = shape
              .getPoints(28)
              .map((p) => new THREE.Vector2((p.x - cx) * scale, (cy - p.y) * scale));
            const scaledShape = new THREE.Shape(pts2);

            if (shape.holes && shape.holes.length > 0) {
              for (const hole of shape.holes) {
                const holePts = hole
                  .getPoints(20)
                  .map((p) => new THREE.Vector2((p.x - cx) * scale, (cy - p.y) * scale));
                scaledShape.holes.push(new THREE.Path(holePts));
              }
            }

            const geometry = new THREE.ExtrudeGeometry(scaledShape, {
              depth: 0.12 * (targetWidth / 2.7),
              bevelEnabled: true,
              bevelThickness: 0.02 * (targetWidth / 2.7),
              bevelSize: 0.015 * (targetWidth / 2.7),
              bevelSegments: 3,
              curveSegments: 24,
            });
            geometry.translate(0, 0, -0.06 * (targetWidth / 2.7));
            geometry.computeVertexNormals();

            const edgesGeometry = new THREE.EdgesGeometry(geometry, 20);
            const edgeMaterial = new THREE.LineBasicMaterial({
              name: "core-edge",
              color: isDarkSurface ? "#7DD3FC" : "#0284C7",
              transparent: true,
              opacity: isDarkSurface ? 0.35 : 0.45,
            });

            nextParts.push({
              id: `svg-part-${partCounter++}`,
              zOffset,
              isDiamond,
              baseOpacity: isDarkSurface ? 0.35 : 0.45,
              geometry,
              material,
              edgesGeometry,
              edgeMaterial,
            });
          }
        }

        if (!nextParts.length) throw new Error("No extrudable SVG shapes");
        builtList = nextParts;
        setParts(nextParts);
        if (!onReadyCalledRef.current) {
          onReadyCalledRef.current = true;
          onReady?.();
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSvgFailed(true);
      });

    return () => {
      mounted = false;
      for (const p of builtList) {
        p.geometry.dispose();
        p.material.dispose();
        p.edgesGeometry.dispose();
        p.edgeMaterial.dispose();
      }
    };
  }, [isDarkSurface, onReady, targetWidth]);

  // Trigger single 360deg GSAP turn cleanly whenever requested
  useEffect(() => {
    if (promptSpinTrigger <= 0 || reducedMotion) return;
    spinTweenRef.current?.kill();
    spinTweenRef.current = gsap.fromTo(
      spinStateRef.current,
      { y: 0 },
      {
        y: Math.PI * 2,
        duration: 1.6,
        ease: "power3.inOut",
        onComplete: () => {
          spinStateRef.current.y = 0;
        },
      }
    );
    return () => {
      spinTweenRef.current?.kill();
    };
  }, [promptSpinTrigger, reducedMotion]);

  // Pause/resume GSAP spin cleanly when off-screen
  useEffect(() => {
    if (!spinTweenRef.current) return;
    if (inView) {
      spinTweenRef.current.resume();
    } else {
      spinTweenRef.current.pause();
    }
  }, [inView]);

  // Smoothly transition diamond and rim colors on stage updates
  useEffect(() => {
    const spec = STAGE_COLORS[activeStage] || STAGE_COLORS.idle;
    diamondFromRef.current.copy(diamondCurrentRef.current);
    diamondTargetRef.current.set(spec.diamond);
    edgeFromRef.current.copy(edgeCurrentRef.current);
    edgeTargetRef.current.set(isDarkSurface ? spec.edge : activeStage === "idle" ? "#0284C7" : spec.edge);
    traceBlendRef.current = 0;
  }, [activeStage, isDarkSurface]);

  useFrame((state, delta) => {
    if (!inView || !pivotRef.current) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    if (traceBlendRef.current < 1) {
      traceBlendRef.current = Math.min(1, traceBlendRef.current + dt / 0.4);
      const ease = 1 - Math.pow(1 - traceBlendRef.current, 2);
      diamondCurrentRef.current.lerpColors(
        diamondFromRef.current,
        diamondTargetRef.current,
        ease
      );
      edgeCurrentRef.current.lerpColors(
        edgeFromRef.current,
        edgeTargetRef.current,
        ease
      );
    }

    const stageSpec = STAGE_COLORS[activeStage] || STAGE_COLORS.idle;
    const pulseIntensity = reducedMotion
      ? 1.15
      : 1.1 + Math.sin(t * stageSpec.pulseSpeed) * 0.32;

    // Entrance fade-in / Scatter exit fade-out + scale down to 0.6
    const targetOpacity = visibilityPhase === "exit" ? 0 : 1;
    const targetPhaseScale = visibilityPhase === "exit" ? 0.6 : 1;
    const phaseAlpha = reducedMotion ? 1 : 1 - Math.exp(-5.5 * dt);
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, phaseAlpha);
    entranceScaleRef.current = THREE.MathUtils.lerp(
      entranceScaleRef.current,
      targetPhaseScale,
      phaseAlpha
    );

    const baseEdgeOp = isDarkSurface ? 0.35 : 0.45;
    pivotRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
        child.material.opacity = opacityRef.current;
        if (
          child.material instanceof THREE.MeshStandardMaterial &&
          child.material.name === "core-diamond"
        ) {
          child.material.emissive.copy(diamondCurrentRef.current);
          child.material.emissiveIntensity = pulseIntensity;
        }
      } else if (
        child instanceof THREE.LineSegments &&
        child.material instanceof THREE.LineBasicMaterial &&
        child.material.name === "core-edge"
      ) {
        child.material.color.copy(edgeCurrentRef.current);
        child.material.opacity = baseEdgeOp * opacityRef.current;
      }
    });

    if (reducedMotion) {
      pivotRef.current.position.set(0, baseY, baseZ);
      pivotRef.current.rotation.set(0, 0, 0);
      pivotRef.current.scale.setScalar(targetPhaseScale);
      return;
    }

    // Idle yaw sweep (+/-35 deg facing camera), slowed smoothly on hover
    sweepPhaseRef.current += dt * (isHovered ? 0.08 : 0.35);
    const sweepYaw = Math.sin(sweepPhaseRef.current) * 0.61;
    const floatY = baseY + Math.sin(t * 0.8) * floatAmplitude;

    const px = pointerOverrideRef?.current ? pointerOverrideRef.current.x : state.pointer.x;
    const py = pointerOverrideRef?.current ? pointerOverrideRef.current.y : state.pointer.y;

    const targetTiltX = -py * 0.095;
    const targetTiltY = px * 0.105;
    const tiltAlpha = 1 - Math.exp(-6 * dt);
    tiltRef.current.x = THREE.MathUtils.lerp(tiltRef.current.x, targetTiltX, tiltAlpha);
    tiltRef.current.y = THREE.MathUtils.lerp(tiltRef.current.y, targetTiltY, tiltAlpha);

    hoverScaleRef.current = THREE.MathUtils.lerp(
      hoverScaleRef.current,
      isHovered && visibilityPhase !== "exit" ? 1.04 : 1.0,
      1 - Math.exp(-8 * dt)
    );

    pivotRef.current.position.set(0, floatY, baseZ);
    pivotRef.current.rotation.x = tiltRef.current.x;
    pivotRef.current.rotation.y = sweepYaw + tiltRef.current.y + spinStateRef.current.y;
    pivotRef.current.scale.setScalar(hoverScaleRef.current * entranceScaleRef.current);
  });

  if (svgFailed) {
    return (
      <Logo3DFallbackPlane
        reducedMotion={reducedMotion}
        inView={inView}
        baseY={baseY}
        targetWidth={targetWidth}
      />
    );
  }

  return (
    <>
      <pointLight
        position={[0, baseY + 0.1, baseZ + 2.45]}
        color="#38BDF8"
        intensity={isDarkSurface ? 1.2 : 0.9}
        distance={7.0}
        decay={2}
      />
      <group
        ref={pivotRef}
        position={[0, baseY, baseZ]}
        onPointerOver={
          onHoverChange
            ? (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                onHoverChange(true);
              }
            : undefined
        }
        onPointerOut={
          onHoverChange
            ? (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                onHoverChange(false);
              }
            : undefined
        }
      >
        {parts ? (
          parts.map((part) => (
            <group key={part.id} position={[0, 0, part.zOffset]}>
              <mesh
                geometry={part.geometry}
                material={part.material}
                castShadow={castShadow}
              />
              <lineSegments
                geometry={part.edgesGeometry}
                material={part.edgeMaterial}
              />
            </group>
          ))
        ) : (
          <mesh>
            <octahedronGeometry args={[0.35 * (targetWidth / 2.7), 0]} />
            <meshStandardMaterial
              color="#C4B5FD"
              emissive="#A78BFA"
              emissiveIntensity={1.1}
            />
          </mesh>
        )}
      </group>
    </>
  );
}

/**
 * Shared extruded 3D CampVion logo group wrapped in its ErrorBoundary.
 */
export function Logo3D(props: Logo3DProps) {
  return (
    <Logo3DErrorBoundary
      fallback={
        <Logo3DFallbackPlane
          reducedMotion={props.reducedMotion}
          inView={props.inView}
          baseY={props.baseY}
          targetWidth={props.targetWidth}
        />
      }
    >
      <Logo3DMesh {...props} />
    </Logo3DErrorBoundary>
  );
}
