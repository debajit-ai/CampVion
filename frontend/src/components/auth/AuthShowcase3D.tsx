"use client";

import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

interface BuiltLogoPart {
  id: string;
  zOffset: number;
  geometry: THREE.ExtrudeGeometry;
  material: THREE.Material;
  edgesGeometry: THREE.EdgesGeometry;
  edgeMaterial: THREE.LineBasicMaterial;
}

class AuthCanvasErrorBoundary extends Component<
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

const AGENT_WAYPOINTS: Array<[number, number, number]> = [
  [-2.1, -0.82, 0.9],
  [2.1, -0.82, 0.7],
  [0.2, -0.82, -2.0],
];

function AuthSceneMesh({
  isDark,
  reducedMotion,
}: {
  isDark: boolean;
  reducedMotion: boolean;
}) {
  const sceneGroupRef = useRef<THREE.Group>(null);
  const logoPivotRef = useRef<THREE.Group>(null);
  const orbsRef = useRef<Array<THREE.Mesh | null>>([null, null, null]);
  const [parts, setParts] = useState<BuiltLogoPart[] | null>(null);
  const [svgFailed, setSvgFailed] = useState(false);

  const tiltRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    let created: BuiltLogoPart[] = [];

    fetch("/brand/campvion-mark-white.svg", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((svgText) => {
        if (!mounted) return;
        const parsed = new SVGLoader().parse(svgText);
        if (!parsed.paths.length) throw new Error("Empty SVG");

        const cx = 342;
        const cy = 464;
        const scale = 1.85 / 684;
        const nextParts: BuiltLogoPart[] = [];
        let idx = 0;

        for (const sp of parsed.paths) {
          const style = (sp.userData as { style?: { fill?: string } } | undefined)?.style;
          const hex = (
            style?.fill || (sp.color ? `#${sp.color.getHexString()}` : "")
          ).toUpperCase();

          let material: THREE.Material;
          let zOffset = 0;

          if (hex === "#A78BFA") {
            zOffset = 0.012;
            material = new THREE.MeshStandardMaterial({
              name: "auth-diamond",
              color: "#C4B5FD",
              emissive: "#A78BFA",
              emissiveIntensity: 1.15,
              metalness: 0.25,
              roughness: 0.2,
            });
          } else if (hex === "#8B5CF6") {
            zOffset = 0.025;
            material = new THREE.MeshStandardMaterial({
              color: "#7C3AED",
              emissive: "#8B5CF6",
              emissiveIntensity: 0.35,
              metalness: 0.5,
              roughness: 0.3,
            });
          } else if (hex === "#C7D0E6") {
            material = new THREE.MeshPhysicalMaterial({
              color: "#AEB9D1",
              metalness: 0.85,
              roughness: 0.24,
              clearcoat: 0.55,
            });
          } else {
            material = new THREE.MeshPhysicalMaterial({
              color: "#DDE6F5",
              metalness: 0.85,
              roughness: 0.24,
              clearcoat: 0.55,
            });
          }

          for (const shape of SVGLoader.createShapes(sp)) {
            const pts = shape
              .getPoints(24)
              .map((p) => new THREE.Vector2((p.x - cx) * scale, (cy - p.y) * scale));
            const scaled = new THREE.Shape(pts);
            const geometry = new THREE.ExtrudeGeometry(scaled, {
              depth: 0.1,
              bevelEnabled: true,
              bevelThickness: 0.016,
              bevelSize: 0.012,
              bevelSegments: 2,
              curveSegments: 20,
            });
            geometry.translate(0, 0, -0.05);
            geometry.computeVertexNormals();

            const edgesGeometry = new THREE.EdgesGeometry(geometry, 20);
            const edgeMaterial = new THREE.LineBasicMaterial({
              color: "#7DD3FC",
              transparent: true,
              opacity: 0.32,
            });

            nextParts.push({
              id: `auth-logo-${idx++}`,
              zOffset,
              geometry,
              material,
              edgesGeometry,
              edgeMaterial,
            });
          }
        }

        created = nextParts;
        setParts(nextParts);
      })
      .catch((err) => {
        if (!mounted || (err instanceof Error && err.name === "AbortError")) return;
        setSvgFailed(true);
      });

    return () => {
      mounted = false;
      controller.abort();
      for (const p of created) {
        p.geometry.dispose();
        p.material.dispose();
        p.edgesGeometry.dispose();
        p.edgeMaterial.dispose();
      }
    };
  }, []);

  const splineSets = useMemo(() => {
    return AGENT_WAYPOINTS.map((end) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.78, 0),
        new THREE.Vector3(end[0] * 0.5, -0.15, end[2] * 0.5),
        new THREE.Vector3(end[0], end[1], end[2]),
      ]);
      return {
        curve,
        points: curve
          .getPoints(28)
          .map((v) => [v.x, v.y, v.z] as [number, number, number]),
      };
    });
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    if (reducedMotion) {
      if (logoPivotRef.current) {
        logoPivotRef.current.position.y = 0.56;
        logoPivotRef.current.rotation.set(0, 0, 0);
      }
      return;
    }

    if (logoPivotRef.current) {
      logoPivotRef.current.position.y = 0.56 + Math.sin(t * 0.8) * 0.05;
      logoPivotRef.current.rotation.y = Math.sin(t * 0.35) * 0.45;

      logoPivotRef.current.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshStandardMaterial &&
          child.material.name === "auth-diamond"
        ) {
          child.material.emissiveIntensity = 1.05 + Math.sin(t * 2.0) * 0.25;
        }
      });
    }

    if (sceneGroupRef.current) {
      const targetX = -state.pointer.y * 0.06;
      const targetY = state.pointer.x * 0.08;
      const a = 1 - Math.exp(-5 * dt);
      tiltRef.current.x = THREE.MathUtils.lerp(tiltRef.current.x, targetX, a);
      tiltRef.current.y = THREE.MathUtils.lerp(tiltRef.current.y, targetY, a);
      sceneGroupRef.current.rotation.x = tiltRef.current.x;
      sceneGroupRef.current.rotation.y = tiltRef.current.y;
    }

    for (let i = 0; i < splineSets.length; i++) {
      const orb = orbsRef.current[i];
      if (!orb) continue;
      const prog = (t * 0.22 + i * 0.33) % 1;
      splineSets[i].curve.getPointAt(prog, orb.position);
    }
  });

  const orbColors = ["#38BDF8", "#34D399", "#FBBF24"];

  return (
    <group ref={sceneGroupRef} position={[0, -0.15, 0]}>
      <ambientLight intensity={isDark ? 0.5 : 0.85} />
      <directionalLight position={[-6, 9, 8]} intensity={1.7} color="#E0F2FE" />
      <directionalLight position={[6, 5, -6]} intensity={1.0} color="#38BDF8" />
      <pointLight position={[0, 0.7, 2.3]} color="#38BDF8" intensity={1.1} distance={6} decay={2} />

      {/* Ground Disc */}
      <mesh position={[0, -0.96, 0]} receiveShadow>
        <cylinderGeometry args={[2.8, 2.95, 0.14, 48]} />
        <meshStandardMaterial
          color={isDark ? "#0A1020" : "#E2E8F0"}
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>

      {/* Subtle Pedestal Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.885, 0]}>
        <ringGeometry args={[1.25, 1.29, 64]} />
        <meshBasicMaterial color="#38BDF8" transparent opacity={0.32} side={THREE.DoubleSide} />
      </mesh>

      {/* Thin Cyan Spline Paths & Agent Orbs */}
      {splineSets.map((s, idx) => (
        <React.Fragment key={idx}>
          <Line
            points={s.points}
            color="#38BDF8"
            lineWidth={1}
            transparent
            opacity={isDark ? 0.38 : 0.48}
          />
          <mesh
            ref={(el) => {
              orbsRef.current[idx] = el;
            }}
            position={AGENT_WAYPOINTS[idx]}
          >
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshBasicMaterial color={orbColors[idx]} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Extruded 3D Shield Logo */}
      <group ref={logoPivotRef} position={[0, 0.56, 0]}>
        {parts ? (
          parts.map((p) => (
            <group key={p.id} position={[0, 0, p.zOffset]}>
              <mesh geometry={p.geometry} material={p.material} />
              <lineSegments geometry={p.edgesGeometry} material={p.edgeMaterial} />
            </group>
          ))
        ) : (
          <mesh>
            <octahedronGeometry args={svgFailed ? [0.55, 0] : [0.35, 0]} />
            <meshStandardMaterial color="#8B5CF6" emissive="#A78BFA" emissiveIntensity={0.8} />
          </mesh>
        )}
      </group>
    </group>
  );
}

export function AuthShowcase3D({ isDark = true }: { isDark?: boolean }) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      setTabVisible(document.visibilityState !== "hidden");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const fallback = (
    <div className="w-full h-full flex items-center justify-center">
      <div className="h-24 w-24 rounded-full border border-[#38BDF8]/30 bg-[#0B1020]/80 flex items-center justify-center">
        <span className="h-3 w-3 rounded-full bg-[#38BDF8] animate-pulse" />
      </div>
    </div>
  );

  return (
    <div
      aria-hidden="true"
      className="w-full h-full relative select-none"
      style={{
        maskImage:
          "radial-gradient(ellipse closest-side at 50% 48%, rgba(0,0,0,1) 72%, rgba(0,0,0,0.55) 86%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse closest-side at 50% 48%, rgba(0,0,0,1) 72%, rgba(0,0,0,0.55) 86%, rgba(0,0,0,0) 100%)",
      }}
    >
      <AuthCanvasErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <Canvas
            dpr={[1, 1.5]}
            frameloop={prefersReducedMotion ? "demand" : tabVisible ? "always" : "never"}
            camera={{ position: [0, 1.4, 5.2], fov: 35 }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            className="w-full h-full block"
          >
            <AuthSceneMesh isDark={isDark} reducedMotion={prefersReducedMotion} />
          </Canvas>
        </Suspense>
      </AuthCanvasErrorBoundary>
    </div>
  );
}
