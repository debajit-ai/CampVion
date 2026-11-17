"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import { AGENT_COLORS, CAMPUS_3D_THEME } from "./theme";

const PIPELINE_MILESTONES = [
  {
    step: "01",
    title: "Intent Parsed",
    detail: "Groq LLM parameter extraction",
    accent: AGENT_COLORS.intentParser,
  },
  {
    step: "02",
    title: "DAG Planned",
    detail: "Kahn's topological sequencing",
    accent: AGENT_COLORS.intentParser,
  },
  {
    step: "03",
    title: "Policy Verified",
    detail: "75% rule & balance validation",
    accent: AGENT_COLORS.policyVerifier,
  },
  {
    step: "04",
    title: "Human Approval",
    detail: "Dean / Warden HITL gate",
    accent: AGENT_COLORS.approvalAgent,
  },
  {
    step: "05",
    title: "Executed",
    detail: "Verified DB commit & trace",
    accent: AGENT_COLORS.policyCore,
  },
];

const NODE_POSITIONS: [number, number, number][] = [
  [-4.4, 0.2, 0.35],
  [-2.2, 0.9, 0.15],
  [0, 1.25, 0],
  [2.2, 0.9, 0.15],
  [4.4, 0.2, 0.35],
];

function Pipeline3DContent({
  progressRef,
  isDark,
}: {
  progressRef: React.RefObject<number>;
  isDark: boolean;
}) {
  const { camera } = useThree();
  const coreRef = useRef<THREE.Mesh>(null);
  const orbRef = useRef<THREE.Mesh>(null);
  const segGroupRef = useRef<THREE.Group>(null);
  const nodeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const orbTemp = useMemo(() => new THREE.Vector3(), []);
  const palette = isDark ? CAMPUS_3D_THEME.dark : CAMPUS_3D_THEME.light;

  const { segments, fullPath } = useMemo(() => {
    const segGeos: THREE.TubeGeometry[] = [];
    const pts: THREE.Vector3[] = [];

    for (let i = 0; i < NODE_POSITIONS.length - 1; i++) {
      const p0 = new THREE.Vector3(...NODE_POSITIONS[i]);
      const p3 = new THREE.Vector3(...NODE_POSITIONS[i + 1]);
      const p1 = new THREE.Vector3(
        THREE.MathUtils.lerp(p0.x, p3.x, 0.33),
        Math.max(p0.y, p3.y) + 0.55,
        THREE.MathUtils.lerp(p0.z, p3.z, 0.33) + 0.25
      );
      const p2 = new THREE.Vector3(
        THREE.MathUtils.lerp(p0.x, p3.x, 0.66),
        Math.max(p0.y, p3.y) + 0.55,
        THREE.MathUtils.lerp(p0.z, p3.z, 0.66) + 0.25
      );

      const bezier = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
      segGeos.push(new THREE.TubeGeometry(bezier, 32, 0.045, 10, false));
      pts.push(...bezier.getPoints(16));
    }

    const full = new THREE.CatmullRomCurve3(pts);
    return { segments: segGeos, fullPath: full };
  }, []);

  useEffect(() => {
    return () => {
      segments.forEach((g) => g.dispose());
    };
  }, [segments]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const p = progressRef.current ?? 0.5;

    const camX = THREE.MathUtils.lerp(0.6, 0, p);
    const camY = THREE.MathUtils.lerp(1.65, 3.1, p);
    const camZ = THREE.MathUtils.lerp(3.6, 9.6, p);

    camera.position.lerp(camTarget.set(camX, camY, camZ), 1 - Math.exp(-8 * dt));
    camera.lookAt(0, 0.65, 0);

    if (coreRef.current) {
      coreRef.current.rotation.y += dt * 0.9;
      coreRef.current.position.y = 1.25 + Math.sin(t * 2.2) * 0.06;
    }

    if (segGroupRef.current) {
      segGroupRef.current.children.forEach((child, idx) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mat = child.material;
        if (!(mat instanceof THREE.MeshStandardMaterial)) return;
        const threshold = (idx + 0.35) / segments.length;
        const active = p >= threshold * 0.65;
        mat.opacity = THREE.MathUtils.lerp(
          mat.opacity,
          active ? 0.95 : 0.28,
          1 - Math.exp(-6 * dt)
        );
        mat.emissiveIntensity = THREE.MathUtils.lerp(
          mat.emissiveIntensity,
          active ? 1.85 : 0.35,
          1 - Math.exp(-6 * dt)
        );
      });
    }

    nodeRefs.current.forEach((mesh, idx) => {
      if (!mesh) return;
      mesh.rotation.y += dt * 0.8;
      const unlocked = p >= idx * 0.18;
      const targetScale = unlocked ? 1.15 : 0.72;
      mesh.scale.setScalar(
        THREE.MathUtils.lerp(mesh.scale.x, targetScale, 1 - Math.exp(-7 * dt))
      );
    });

    if (orbRef.current) {
      const orbT = (t * 0.22) % 1;
      fullPath.getPointAt(orbT, orbTemp);
      orbRef.current.position.copy(orbTemp);
      orbRef.current.rotation.y += dt * 3;
    }
  });

  return (
    <group>
      <color attach="background" args={[isDark ? "#070B16" : palette.bg]} />
      <ambientLight intensity={isDark ? 0.65 : 1.2} />
      <directionalLight
        position={[6, 10, 8]}
        intensity={1.3}
        color={palette.keyLight}
      />
      <pointLight
        position={[0, 2.5, 2]}
        intensity={2.6}
        color={AGENT_COLORS.intentParser}
      />

      {/* 4 Glowing 3D Bezier Curve Tubes connecting the 5 Milestones */}
      <group ref={segGroupRef}>
        {segments.map((geo, idx) => (
          <mesh key={idx} geometry={geo}>
            <meshStandardMaterial
              color={palette.splineLit}
              emissive={palette.splineIdle}
              emissiveIntensity={0.85}
              transparent
              opacity={0.45}
              roughness={0.2}
            />
          </mesh>
        ))}
      </group>

      {/* 5 Crystalline Pipeline Milestone Nodes */}
      {NODE_POSITIONS.map((pos, idx) => {
        const isCore = idx === 2;
        const nodeAccent = PIPELINE_MILESTONES[idx].accent;
        return (
          <mesh
            key={idx}
            ref={(el) => {
              if (isCore) coreRef.current = el;
              nodeRefs.current[idx] = el;
            }}
            position={pos}
          >
            <octahedronGeometry args={[isCore ? 0.52 : 0.34, 0]} />
            <meshStandardMaterial
              color={isCore ? nodeAccent : palette.wall}
              emissive={nodeAccent}
              emissiveIntensity={isCore ? 1.35 : 0.45}
              roughness={0.2}
              metalness={0.18}
            />
            {!isCore && <Edges threshold={15} color={nodeAccent} />}
          </mesh>
        );
      })}

      {/* Traveling Cyan Agent Packet */}
      <mesh ref={orbRef}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive={AGENT_COLORS.intentParser}
          emissiveIntensity={2.2}
        />
      </mesh>
    </group>
  );
}

export default function ScrollytellingPipeline({
  isDark = true,
}: {
  isDark?: boolean;
}) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<number>(0);
  const [activeStep, setActiveStep] = useState(0);
  const [inView, setInView] = useState(false);
  const [isMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });
  const prefersReducedMotion = Boolean(useReducedMotion());

  useEffect(() => {
    const el = sectionRef.current;
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

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || prefersReducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      end: "bottom 25%",
      scrub: 0.5,
      onUpdate: (self) => {
        progressRef.current = self.progress;
        const stepIdx = Math.min(
          PIPELINE_MILESTONES.length - 1,
          Math.floor(self.progress * PIPELINE_MILESTONES.length)
        );
        setActiveStep((prev) => (prev !== stepIdx ? stepIdx : prev));
      },
    });

    return () => {
      trigger.kill();
    };
  }, [prefersReducedMotion]);

  return (
    <div
      ref={sectionRef}
      className={`rounded-3xl backdrop-blur-xl border overflow-hidden transition-colors ${
        isDark
          ? "bg-[#0B1020]/85 border-white/10 shadow-[0_24px_64px_-18px_rgba(34,211,238,0.14)]"
          : "bg-white/92 border-slate-200/80 shadow-[0_24px_64px_-18px_rgba(79,70,229,0.12)]"
      }`}
    >
      {/* Top Header Strip */}
      <div
        className={`px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-2 ${
          isDark
            ? "bg-[#0B1020] border-white/10"
            : "bg-white border-slate-200/70"
        }`}
      >
        <div className="flex items-center space-x-2">
          <Sparkles
            className={`h-3.5 w-3.5 ${
              isDark ? "text-[#22D3EE]" : "text-[#0E7490]"
            }`}
          />
          <span
            className={`text-[11px] font-mono font-extrabold uppercase tracking-wider ${
              isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
            }`}
          >
            Scroll-Driven 3D Bezier Execution Graph
          </span>
        </div>
        <span
          className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
            isDark
              ? "bg-indigo-500/15 text-[#22D3EE] border-cyan-400/25"
              : "bg-indigo-50 text-[#4338CA] border-indigo-200/80"
          }`}
        >
          Policy Core Zoom &rarr; 5-Step Pipeline
        </span>
      </div>

      {/* Short & Smooth 3D Bezier Stage */}
      {!isMobile && !prefersReducedMotion ? (
        <div
          className={`w-full h-[250px] sm:h-[290px] relative ${
            isDark ? "bg-[#070B16]" : "bg-[#F6F7FB]"
          }`}
        >
          <Canvas
            dpr={[1, 1.75]}
            frameloop={inView ? "always" : "never"}
            camera={{ position: [0.6, 1.65, 3.6], fov: 36 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
          >
            <Pipeline3DContent progressRef={progressRef} isDark={isDark} />
          </Canvas>
        </div>
      ) : (
        <div
          className={`px-5 py-4 border-b flex items-center justify-center ${
            isDark
              ? "bg-[#070B16] border-white/10"
              : "bg-indigo-50/50 border-slate-200/70"
          }`}
        >
          <div
            className={`h-1.5 w-full max-w-2xl rounded-full overflow-hidden ${
              isDark ? "bg-white/10" : "bg-indigo-100"
            }`}
          >
            <div className="h-full w-full bg-gradient-to-r from-[#6366F1] via-[#22D3EE] to-[#34D399]" />
          </div>
        </div>
      )}

      {/* Synchronized 5-Step Pipeline Milestone Bar */}
      <div
        className={`p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 border-t ${
          isDark
            ? "bg-[#0B1020] border-white/10"
            : "bg-white border-slate-200/70"
        }`}
      >
        {PIPELINE_MILESTONES.map((m, idx) => {
          const isLit = prefersReducedMotion || idx <= activeStep;
          return (
            <div
              key={m.step}
              className={`p-3 rounded-2xl border transition-all duration-300 ${
                isLit
                  ? isDark
                    ? "bg-[#05070F]/80 border-[#22D3EE]/45 shadow-[0_8px_24px_rgba(34,211,238,0.12)]"
                    : "bg-indigo-50/50 border-indigo-400/55 shadow-xs"
                  : isDark
                  ? "bg-[#05070F]/35 border-white/8 text-[#8B95B0]"
                  : "bg-slate-50 border-slate-200/70 text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  style={
                    isLit ? { backgroundColor: m.accent, color: "#05070F" } : undefined
                  }
                  className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md ${
                    isLit
                      ? ""
                      : isDark
                      ? "bg-white/10 text-[#8B95B0]"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {m.step}
                </span>
                <CheckCircle2
                  style={isLit ? { color: m.accent } : undefined}
                  className={`h-3.5 w-3.5 transition-colors ${
                    isLit
                      ? ""
                      : isDark
                      ? "text-white/15"
                      : "text-slate-300"
                  }`}
                />
              </div>
              <h4
                className={`text-xs font-bold ${
                  isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                }`}
              >
                {m.title}
              </h4>
              <p
                className={`text-[10px] mt-0.5 leading-snug ${
                  isDark ? "text-[#8B95B0]" : "text-slate-500"
                }`}
              >
                {m.detail}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
