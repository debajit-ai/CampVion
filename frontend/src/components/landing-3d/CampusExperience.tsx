"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { BuildingId, TraceStage } from "./campusData";
import { CampusScene } from "./CampusScene";
import { PromptSandboxHUD } from "./PromptSandboxHUD";
import { LandingColorMode } from "./theme";

interface CampusExperienceProps {
  themeMode?: LandingColorMode;
  selectedId: BuildingId | null;
  hoveredId: BuildingId | null;
  activePresetId: string | null;
  resetTrigger: number;
  promptSpinTrigger?: number;
  onSelectBuilding: (id: BuildingId) => void;
  onHoverBuilding: (id: BuildingId | null) => void;
  onClearSelection: () => void;
}

export default function CampusExperience({
  themeMode = "dark",
  selectedId,
  hoveredId,
  activePresetId,
  resetTrigger,
  promptSpinTrigger = 0,
  onSelectBuilding,
  onHoverBuilding,
  onClearSelection,
}: CampusExperienceProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [lightingOverride, setLightingOverride] = useState<{
    base: LandingColorMode;
    isDark: boolean;
  } | null>(null);
  const [inView, setInView] = useState(true);
  const [sceneReady, setSceneReady] = useState(prefersReducedMotion);
  const [traceStage, setTraceStage] = useState<TraceStage>("idle");

  const isNightMode =
    lightingOverride && lightingOverride.base === themeMode
      ? lightingOverride.isDark
      : themeMode === "dark";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLElement | null>>({});

  // Pause WebGL rendering cleanly when scrolled off-screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]) {
          setInView(entries[0].isIntersecting);
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Safety timeout so preload overlay fades cleanly even on slow software WebGL
  useEffect(() => {
    if (sceneReady) return;
    const timer = window.setTimeout(() => {
      setSceneReady(true);
    }, 1250);
    return () => window.clearTimeout(timer);
  }, [sceneReady]);

  const handleSceneReady = useCallback(() => {
    window.setTimeout(() => {
      setSceneReady(true);
    }, 260);
  }, []);

  const getLabelRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      labelRefs.current[id] = el;
    },
    []
  );

  // Collision-guarded label projection: flips inward near edges and hides if entering left text column
  const updateLabelPosition = useCallback(
    (
      id: string,
      x: number,
      y: number,
      visible: boolean,
      interactive: boolean,
      viewportWidth: number,
      viewportHeight: number
    ) => {
      const el = labelRefs.current[id];
      if (!el) return;

      const outOfSafeZone =
        !visible ||
        x < 24 ||
        x > viewportWidth - 20 ||
        y < 34 ||
        y > viewportHeight - 20;

      if (outOfSafeZone) {
        el.style.opacity = "0";
        if (interactive) el.style.pointerEvents = "none";
        return;
      }

      let anchorX = "-50%";
      let clampedX = x;
      if (x < 96) {
        anchorX = "0%";
        clampedX = Math.max(16, x);
      } else if (x > viewportWidth - 96) {
        anchorX = "-100%";
        clampedX = Math.min(viewportWidth - 14, x);
      }

      el.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${y.toFixed(
        1
      )}px, 0) translate(${anchorX}, -50%)`;
      el.style.opacity = "1";
      if (interactive) el.style.pointerEvents = "auto";
    },
    []
  );

  const handleToggleNightMode = () => {
    setLightingOverride({ base: themeMode, isDark: !isNightMode });
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-[380px] sm:min-h-[450px] lg:min-h-0 relative select-none transition-colors duration-700 ${
        isNightMode ? "bg-[#05070F]" : "bg-[#F6F7FB]"
      }`}
    >
      {/* WebGL Canvas Wrapped in Radial Edge Mask (fades outer 12% of every edge softly) */}
      <div
        className="absolute inset-0"
        style={{
          maskImage:
            "radial-gradient(ellipse closest-side at 50% 50%, rgba(0,0,0,1) 76%, rgba(0,0,0,0.62) 88%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse closest-side at 50% 50%, rgba(0,0,0,1) 76%, rgba(0,0,0,0.62) 88%, rgba(0,0,0,0) 100%)",
        }}
      >
        <CampusScene
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelectBuilding}
          onHoverChange={onHoverBuilding}
          isNightMode={isNightMode}
          resetTrigger={resetTrigger}
          promptSpinTrigger={promptSpinTrigger}
          activeTraceStage={selectedId ? traceStage : "idle"}
          onProjectLabel={updateLabelPosition}
          inView={inView}
          reducedMotion={prefersReducedMotion}
          onSceneReady={handleSceneReady}
        />
      </div>

      {/* Subtle Vignette & Ultra-Light Desktop Film Grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-500"
        style={{
          background: isNightMode
            ? "radial-gradient(circle at 50% 50%, transparent 52%, rgba(5, 7, 15, 0.45) 100%)"
            : "radial-gradient(circle at 50% 50%, transparent 62%, rgba(15, 23, 42, 0.05) 100%)",
        }}
      />
      {!prefersReducedMotion && (
        <div
          aria-hidden="true"
          className="hidden md:block pointer-events-none absolute inset-0 z-10 opacity-[0.025] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      )}

      {/* Preload Overlay */}
      <AnimatePresence>
        {!sceneReady && !prefersReducedMotion && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-md ${
              isNightMode ? "bg-[#05070F]/92" : "bg-[#F6F7FB]/92"
            }`}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="w-32 sm:w-36 flex items-center justify-center">
                <BrandLogo
                  variant="lockup"
                  isDark={isNightMode}
                  size={144}
                  alt=""
                  priority
                  className="w-full h-auto"
                />
              </div>
              <div className="w-44 h-1 rounded-full overflow-hidden bg-white/10">
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "0%" }}
                  transition={{ duration: 0.75, ease: "easeOut" }}
                  className="h-full w-full bg-[#38BDF8]"
                />
              </div>
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                  isNightMode ? "text-[#38BDF8]" : "text-[#0E7490]"
                }`}
              >
                Initializing Campus Twin
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Projected Labels, Toggle, & Inspection Card inside Canvas Zone */}
      <PromptSandboxHUD
        selectedId={selectedId}
        hoveredId={hoveredId}
        activePresetId={activePresetId}
        isNightMode={isNightMode}
        onToggleNightMode={handleToggleNightMode}
        onSelectBuilding={onSelectBuilding}
        onHoverBuilding={onHoverBuilding}
        onClearSelection={() => {
          setTraceStage("idle");
          onClearSelection();
        }}
        onTraceStageChange={setTraceStage}
        getLabelRef={getLabelRef}
      />
    </div>
  );
}
