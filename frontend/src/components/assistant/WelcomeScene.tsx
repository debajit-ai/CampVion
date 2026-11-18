"use client";

import React, {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { motion, useReducedMotion } from "framer-motion";
import { Logo3D, Logo3DState } from "../brand/Logo3D";
import { BrandLogo } from "../BrandLogo";
import { WORKSPACE_PALETTE } from "../landing-3d/theme";

const emptySubscribe = () => () => {};

function subscribeWindowResize(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

export interface WelcomeSuggestion {
  label: string;
  prompt: string;
}

export interface WelcomeSceneProps {
  leadLine: string; // "Welcome back," or "Welcome,"
  firstName: string; // Title Case first name only, e.g. "Debajit"
  subtitle?: string;
  suggestions: WelcomeSuggestion[];
  assistantState?: Logo3DState;
  isDark?: boolean;
  isScattering?: boolean;
  onScatterComplete?: () => void;
  onSelectSuggestion: (prompt: string) => void;
  forceReducedMotion?: boolean;
}

interface SampledTextDots {
  targets: Float32Array;
  starts: Float32Array;
  colors: Float32Array;
  phases: Float32Array;
  delays: Float32Array;
  sizes: Float32Array;
  count: number;
  textCenterY: number;
  halfSpanX: number;
  halfSpanY: number;
}

const DOT_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uIntroLead;
  uniform float uPixelRatio;
  uniform float uWorldPerPixel;
  uniform float uScatterProgress;
  uniform float uPointerStrength;
  uniform vec2 uPointerWorld;
  uniform vec2 uTextCenter;
  uniform vec2 uTextHalfSpan;
  uniform float uIsDark;

  attribute vec3 aScatterStart;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aDelay;
  attribute float aSize;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vShimmer;

  // Deterministic pseudo-curl swirl vector field for organic scatter drift
  vec3 swirlVelocity(vec3 p, float seed) {
    float a = sin(p.y * 2.4 + seed) * cos(p.z * 2.1 + seed * 0.7);
    float b = cos(p.x * 2.1 + seed * 1.3) * sin(p.y * 1.9 - seed);
    float c = sin(p.x * 1.7 - p.y * 2.3 + seed * 0.5);
    return vec3(a - b * 0.45, abs(b) * 0.55 + 0.42, c * 0.85);
  }

  void main() {
    // 1. Staggered left-to-right assembly intro (~1.6s total after logo lead)
    float localIntroT = clamp((uTime - uIntroLead - aDelay * 0.52) / 1.05, 0.0, 1.0);
    float settle = 1.0 - pow(1.0 - localIntroT, 3.0);

    vec3 basePos = mix(aScatterStart, position, settle);

    // 2. Gentle organic breathing (~1.5 px in screen space)
    float breathAmp = 1.45 * uWorldPerPixel * settle;
    basePos.x += cos(uTime * 1.35 + aPhase) * breathAmp;
    basePos.y += sin(uTime * 1.05 + aPhase * 1.37) * breathAmp;

    // 3. Smooth ~60px GPU pointer repel + spring return
    float repelRadius = max(60.0 * uWorldPerPixel, 0.001);
    vec2 toDot = basePos.xy - uPointerWorld;
    float ptrDist = length(toDot);
    if (uPointerStrength > 0.001 && ptrDist < repelRadius && settle > 0.4) {
      float falloff = pow(1.0 - ptrDist / repelRadius, 2.0) * uPointerStrength * settle;
      vec2 pushDir = ptrDist > 0.0001 ? toDot / ptrDist : vec2(0.0, 1.0);
      basePos.xy += pushDir * (28.0 * uWorldPerPixel * falloff);
      basePos.z += 0.22 * falloff;
    }

    // 4. First-send scatter (~1.1s, center first, outward + swirl + slight upward drift)
    float sp = 0.0;
    if (uScatterProgress > 0.0) {
      vec2 rel = (position.xy - uTextCenter) / max(uTextHalfSpan, vec2(0.35, 0.18));
      float centerNorm = clamp(length(rel) / 1.414, 0.0, 1.0);
      float scatterDelay = centerNorm * 0.26;
      sp = clamp((uScatterProgress - scatterDelay) / (1.0 - 0.26), 0.0, 1.0);
      float spEase = sp * sp * (2.1 - 1.1 * sp);

      vec2 outXY = position.xy - uTextCenter;
      float outLen = length(outXY);
      vec2 radialDir = outLen > 0.001 ? outXY / outLen : vec2(cos(aPhase), sin(aPhase));
      vec3 swirl = swirlVelocity(position + vec3(uTime * 0.25), aPhase);

      vec3 velocity = vec3(radialDir * (1.8 + fract(aPhase) * 1.6), 0.45 * sin(aPhase * 2.0))
                    + swirl * 1.35;
      basePos += velocity * spEase * 1.45;
      basePos.y += 0.35 * spEase;
    }

    // 5. Left-to-right slow brightness shimmer pass every ~6 seconds
    float shimmerCycle = mod(uTime, 6.0);
    float shimmerActive = step(shimmerCycle, 1.55);
    float waveNormX = (shimmerCycle / 1.55) * 1.4 - 0.2;
    float normX = clamp((position.x - (uTextCenter.x - uTextHalfSpan.x)) / max(uTextHalfSpan.x * 2.0, 0.1), 0.0, 1.0);
    float shimmerBand = exp(-pow((normX - waveNormX) / 0.11, 2.0)) * shimmerActive * settle;

    vec4 mvPosition = modelViewMatrix * vec4(basePos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float sizeAtten = 10.0 / max(-mvPosition.z, 1.0);
    float scatterShrink = 1.0 - 0.72 * sp;
    float introScale = mix(0.6, 1.0, settle);
    gl_PointSize = clamp(aSize * uPixelRatio * sizeAtten * introScale * scatterShrink, 1.4, 9.5);

    vColor = aColor;
    vShimmer = shimmerBand;

    float introAlpha = mix(0.12, 1.0, smoothstep(0.0, 0.65, localIntroT));
    float scatterAlpha = 1.0 - smoothstep(0.28, 1.0, sp);
    float baseAlpha = uIsDark > 0.5 ? 0.92 : 0.94;
    vAlpha = clamp(baseAlpha * introAlpha * scatterAlpha, 0.0, 1.0);
  }
`;

const DOT_FRAGMENT_SHADER = /* glsl */ `
  uniform float uIsDark;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vShimmer;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float softEdge = smoothstep(0.5, 0.14, d);
    float core = smoothstep(0.32, 0.0, d);

    vec3 col = vColor;
    if (uIsDark > 0.5) {
      col += vec3(0.14, 0.24, 0.30) * core + vec3(0.22, 0.34, 0.42) * vShimmer;
    } else {
      col = mix(col, vec3(0.055, 0.455, 0.565), clamp(vShimmer * 0.75, 0.0, 0.75));
    }

    float finalAlpha = vAlpha * softEdge;
    if (finalAlpha < 0.01) discard;
    gl_FragColor = vec4(col, finalAlpha);
  }
`;

function seededHash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function buildDottedGreetingData(
  leadLine: string,
  firstName: string,
  fontFamily: string,
  worldWidth: number,
  worldCenterY: number,
  isMobile: boolean,
  isDark: boolean
): SampledTextDots {
  const targetMin = isMobile ? 2500 : 6000;
  const targetMax = isMobile ? 3500 : 9000;

  // Oversampled offscreen canvas gives dense alpha coverage so a 3-4px grid yields crisp dotted strokes
  const sampleScale = isMobile ? 2.2 : 2.5;
  const cssW = isMobile ? 340 : 680;
  const cssH = isMobile ? 112 : 148;
  const offW = Math.round(cssW * sampleScale);
  const offH = Math.round(cssH * sampleScale);

  const canvas = document.createElement("canvas");
  canvas.width = offW;
  canvas.height = offH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const cleanLine1 = leadLine.trim();
  const cleanLine2 = firstName.trim() || "Student";

  const palette = isDark ? WORKSPACE_PALETTE.dark : WORKSPACE_PALETTE.light;
  const line1Color = new THREE.Color(palette.text);
  const line2LeftColor = new THREE.Color(isDark ? "#6366F1" : "#4338CA");
  const line2RightColor = new THREE.Color(isDark ? "#22D3EE" : "#0E7490");

  if (!ctx) {
    return {
      targets: new Float32Array(0),
      starts: new Float32Array(0),
      colors: new Float32Array(0),
      phases: new Float32Array(0),
      delays: new Float32Array(0),
      sizes: new Float32Array(0),
      count: 0,
      textCenterY: worldCenterY,
      halfSpanX: 1,
      halfSpanY: 0.4,
    };
  }

  ctx.clearRect(0, 0, offW, offH);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Line 1: "Welcome back,"
  const line1FontPx = Math.round((isMobile ? 26 : 38) * sampleScale);
  ctx.font = `600 ${line1FontPx}px ${fontFamily}`;
  ctx.fillStyle = isDark ? "#F5F7FF" : "#0B1020";
  const line1Y = Math.round(offH * 0.26);
  ctx.fillText(cleanLine1, offW / 2, line1Y);

  // Line 2: First Name with auto-fit width clamp so long names never clip
  let line2FontPx = Math.round((isMobile ? 46 : 64) * sampleScale);
  ctx.font = `800 ${line2FontPx}px ${fontFamily}`;
  const maxTextPx = offW * 0.90;
  let measuredW = ctx.measureText(cleanLine2).width;
  if (measuredW > maxTextPx && measuredW > 0) {
    line2FontPx = Math.max(Math.round(line2FontPx * (maxTextPx / measuredW)), Math.round(24 * sampleScale));
    ctx.font = `800 ${line2FontPx}px ${fontFamily}`;
    measuredW = ctx.measureText(cleanLine2).width;
  }

  const line2Y = Math.round(offH * 0.67);
  const gradLeft = Math.max(0, offW / 2 - measuredW / 2);
  const gradRight = Math.min(offW, offW / 2 + measuredW / 2);
  const grad = ctx.createLinearGradient(gradLeft, 0, Math.max(gradLeft + 1, gradRight), 0);
  grad.addColorStop(0, isDark ? "#6366F1" : "#4338CA");
  grad.addColorStop(1, isDark ? "#22D3EE" : "#0E7490");
  ctx.fillStyle = grad;
  ctx.fillText(cleanLine2, offW / 2, line2Y);

  const img = ctx.getImageData(0, 0, offW, offH).data;
  const splitY = Math.round(offH * 0.45);

  const collectGridSamples = (stepPx: number) => {
    const rawPts: Array<{ px: number; py: number; isLine2: boolean }> = [];
    for (let y = 1; y < offH - 1; y += stepPx) {
      for (let x = 1; x < offW - 1; x += stepPx) {
        const jx = Math.min(
          offW - 1,
          Math.max(0, Math.round(x + (seededHash(x * 13 + y * 7) - 0.5) * (stepPx * 0.45)))
        );
        const jy = Math.min(
          offH - 1,
          Math.max(0, Math.round(y + (seededHash(x * 29 + y * 19) - 0.5) * (stepPx * 0.45)))
        );
        const alpha = img[(jy * offW + jx) * 4 + 3];
        if (alpha > 128) {
          rawPts.push({ px: jx, py: jy, isLine2: jy >= splitY });
        }
      }
    }
    return rawPts;
  };

  // Start at 3.5-4px equivalent on oversampled grid, adapt cleanly to guarantee target count
  let collected = collectGridSamples(isMobile ? 4 : 3);
  if (collected.length < targetMin) {
    collected = collectGridSamples(2);
  }
  if (collected.length > targetMax) {
    const keepRatio = targetMax / collected.length;
    const thinned: typeof collected = [];
    let accum = 0;
    for (let i = 0; i < collected.length; i++) {
      accum += keepRatio;
      if (accum >= 1) {
        thinned.push(collected[i]);
        accum -= 1;
      }
    }
    collected = thinned;
  }

  const count = collected.length;
  const targets = new Float32Array(count * 3);
  const starts = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const delays = new Float32Array(count);
  const sizes = new Float32Array(count);

  const worldHeight = worldWidth * (offH / offW);
  let minWX = Infinity;
  let maxWX = -Infinity;
  let minWY = Infinity;
  let maxWY = -Infinity;

  const tmpColor = new THREE.Color();
  const line2XMin = gradLeft;
  const line2XSpan = Math.max(1, gradRight - gradLeft);

  for (let i = 0; i < count; i++) {
    const pt = collected[i];
    const nx = pt.px / offW; // [0..1] left -> right
    const ny = pt.py / offH; // [0..1] top -> bottom

    const wx = (nx - 0.5) * worldWidth;
    const wy = worldCenterY + (0.5 - ny) * worldHeight;
    const wz = (seededHash(i + 1.3) - 0.5) * 0.06;

    if (wx < minWX) minWX = wx;
    if (wx > maxWX) maxWX = wx;
    if (wy < minWY) minWY = wy;
    if (wy > maxWY) maxWY = wy;

    targets[i * 3] = wx;
    targets[i * 3 + 1] = wy;
    targets[i * 3 + 2] = wz;

    // Wider initial scatter volume around the greeting
    const r1 = seededHash(i * 3.1 + 5);
    const r2 = seededHash(i * 7.7 + 11);
    const r3 = seededHash(i * 11.3 + 17);
    starts[i * 3] = wx + (r1 - 0.5) * worldWidth * 0.85;
    starts[i * 3 + 1] = wy + (r2 - 0.5) * worldHeight * 2.2;
    starts[i * 3 + 2] = (r3 - 0.5) * 2.4;

    if (!pt.isLine2) {
      tmpColor.copy(line1Color);
    } else {
      const lx = Math.max(0, Math.min(1, (pt.px - line2XMin) / line2XSpan));
      tmpColor.copy(line2LeftColor).lerp(line2RightColor, lx);
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;

    phases[i] = seededHash(i * 5.3 + 2) * Math.PI * 2;
    delays[i] = nx;
    sizes[i] = (isMobile ? 2.2 : 2.35) + seededHash(i * 9.1) * 0.75;
  }

  return {
    targets,
    starts,
    colors,
    phases,
    delays,
    sizes,
    count,
    textCenterY: count > 0 ? (minWY + maxWY) * 0.5 : worldCenterY,
    halfSpanX: count > 0 ? Math.max(0.4, (maxWX - minWX) * 0.5) : 1.0,
    halfSpanY: count > 0 ? Math.max(0.2, (maxWY - minWY) * 0.5) : 0.4,
  };
}

function detectLowPowerDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores <= 2) return true;
  const navWithMemory = navigator as Navigator & { deviceMemory?: number };
  if (typeof navWithMemory.deviceMemory === "number" && navWithMemory.deviceMemory <= 2) {
    return true;
  }
  return false;
}

function detectWebGLAvailable(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

class WelcomeCanvasErrorBoundary extends Component<
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

interface InnerSceneProps {
  leadLine: string;
  firstName: string;
  assistantState: Logo3DState;
  isDark: boolean;
  isMobile: boolean;
  inView: boolean;
  isScattering: boolean;
  onScatterComplete?: () => void;
  pointerNdcRef: React.RefObject<{ x: number; y: number; active: boolean }>;
}

function WelcomeCanvasContent({
  leadLine,
  firstName,
  assistantState,
  isDark,
  isMobile,
  inView,
  isScattering,
  onScatterComplete,
  pointerNdcRef,
}: InnerSceneProps) {
  const { viewport, size, gl } = useThree();
  const [fontsReady, setFontsReady] = useState(
    () => typeof document === "undefined" || !document.fonts?.ready
  );
  const [sampled, setSampled] = useState<SampledTextDots | null>(null);
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  const pointsRef = useRef<THREE.Points>(null);
  const elapsedRef = useRef(0);
  const scatterProgressRef = useRef(0);
  const scatterNotifiedRef = useRef(false);
  const pointerWorldRef = useRef(new THREE.Vector2(999, 999));
  const pointerStrengthRef = useRef(0);
  const logoPointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (fontsReady) return;
    let active = true;
    document.fonts.ready
      .then(() => {
        if (active) setFontsReady(true);
      })
      .catch(() => {
        if (active) setFontsReady(true);
      });
    return () => {
      active = false;
    };
  }, [fontsReady]);

  // Re-sample greeting dots cleanly whenever name, fonts, theme, or viewport width settles (debounced)
  const sampleWorldWidth = Math.min(viewport.width * 0.92, isMobile ? 6.8 : 8.8);
  const logoBaseY = isMobile ? 1.56 : 1.44;
  const logoTargetWidth = isMobile ? 2.42 : 2.75; // ~148px mobile, ~195-200px tall on desktop
  const textWorldCenterY = isMobile ? -1.72 : -1.78;

  useEffect(() => {
    if (!fontsReady) return;
    const timer = window.setTimeout(() => {
      const fontFamily =
        typeof window !== "undefined"
          ? window.getComputedStyle(document.body).fontFamily || "Inter, sans-serif"
          : "Inter, sans-serif";
      const data = buildDottedGreetingData(
        leadLine,
        firstName,
        fontFamily,
        sampleWorldWidth,
        textWorldCenterY,
        isMobile,
        isDark
      );
      setSampled(data);
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fontsReady, leadLine, firstName, sampleWorldWidth, textWorldCenterY, isMobile, isDark]);

  const pointsGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    if (!sampled || sampled.count === 0) return geom;

    geom.setAttribute("position", new THREE.BufferAttribute(sampled.targets, 3));
    geom.setAttribute("aScatterStart", new THREE.BufferAttribute(sampled.starts, 3));
    geom.setAttribute("aColor", new THREE.BufferAttribute(sampled.colors, 3));
    geom.setAttribute("aPhase", new THREE.BufferAttribute(sampled.phases, 1));
    geom.setAttribute("aDelay", new THREE.BufferAttribute(sampled.delays, 1));
    geom.setAttribute("aSize", new THREE.BufferAttribute(sampled.sizes, 1));
    geom.computeBoundingSphere();
    return geom;
  }, [sampled]);

  useEffect(() => {
    return () => {
      pointsGeometry.dispose();
    };
  }, [pointsGeometry]);

  const pointsMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntroLead: { value: 0.35 },
        uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.75) : 1 },
        uWorldPerPixel: { value: 0.018 },
        uScatterProgress: { value: 0 },
        uPointerStrength: { value: 0 },
        uPointerWorld: { value: new THREE.Vector2(999, 999) },
        uTextCenter: { value: new THREE.Vector2(0, textWorldCenterY) },
        uTextHalfSpan: { value: new THREE.Vector2(2.0, 0.5) },
        uIsDark: { value: isDark ? 1 : 0 },
      },
      vertexShader: DOT_VERTEX_SHADER,
      fragmentShader: DOT_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    // Recreate cleanly when dark/light blending mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  useEffect(() => {
    return () => {
      pointsMaterial.dispose();
    };
  }, [pointsMaterial]);

  // Cleanly dispose WebGL resources when WelcomeScene unmounts after scatter
  useEffect(() => {
    return () => {
      try {
        gl.renderLists.dispose();
      } catch {
        // Safe cleanup guard
      }
    };
  }, [gl]);

  useFrame((state, delta) => {
    if (!inView) return;
    const dt = Math.min(delta, 0.05);
    elapsedRef.current += dt;

    // Update GPU pointer coordinates smoothly in world units
    const ptr = pointerNdcRef.current;
    const active = ptr?.active ?? false;
    const ndcX = ptr ? ptr.x : state.pointer.x;
    const ndcY = ptr ? ptr.y : state.pointer.y;

    logoPointerRef.current.x = ndcX;
    logoPointerRef.current.y = ndcY;

    if (active) {
      pointerWorldRef.current.set(ndcX * (viewport.width * 0.5), ndcY * (viewport.height * 0.5));
      pointerStrengthRef.current = THREE.MathUtils.lerp(
        pointerStrengthRef.current,
        1.0,
        1 - Math.exp(-16 * dt)
      );
    } else {
      pointerStrengthRef.current = THREE.MathUtils.lerp(
        pointerStrengthRef.current,
        0.0,
        1 - Math.exp(-9 * dt)
      );
    }

    // Advance 1.1s scatter sequence smoothly on first message send
    if (isScattering) {
      scatterProgressRef.current = Math.min(1, scatterProgressRef.current + dt / 1.05);
      if (scatterProgressRef.current >= 1 && !scatterNotifiedRef.current) {
        scatterNotifiedRef.current = true;
        onScatterComplete?.();
      }
    }

    const mat = pointsRef.current?.material as THREE.ShaderMaterial | undefined;
    if (mat?.uniforms) {
      mat.uniforms.uTime.value = elapsedRef.current;
      mat.uniforms.uPixelRatio.value =
        state.viewport.dpr || Math.min(window.devicePixelRatio || 1, 1.75);
      mat.uniforms.uWorldPerPixel.value =
        size.height > 0 ? viewport.height / size.height : 0.018;
      mat.uniforms.uIsDark.value = isDark ? 1 : 0;
      (mat.uniforms.uPointerWorld.value as THREE.Vector2).copy(pointerWorldRef.current);
      mat.uniforms.uPointerStrength.value = pointerStrengthRef.current;
      mat.uniforms.uScatterProgress.value = scatterProgressRef.current;
      if (sampled) {
        (mat.uniforms.uTextCenter.value as THREE.Vector2).set(0, sampled.textCenterY);
        (mat.uniforms.uTextHalfSpan.value as THREE.Vector2).set(
          sampled.halfSpanX,
          sampled.halfSpanY
        );
      }
    }
  });

  return (
    <>
      <ambientLight intensity={isDark ? 0.55 : 0.72} />
      <hemisphereLight
        args={[isDark ? "#7DD3FC" : "#FFFFFF", isDark ? "#05070F" : "#CBD5E1", isDark ? 0.65 : 0.9]}
      />
      <directionalLight position={[-6, 9, 8]} intensity={isDark ? 1.8 : 1.5} color="#F8FAFC" />
      <directionalLight position={[6, 4, -5]} intensity={isDark ? 1.1 : 0.85} color="#38BDF8" />

      <Logo3D
        inView={inView}
        reducedMotion={false}
        activeStage={assistantState}
        isDarkSurface={isDark}
        targetWidth={logoTargetWidth}
        baseY={logoBaseY}
        baseZ={0}
        floatAmplitude={0.07}
        castShadow={false}
        isHovered={isLogoHovered}
        onHoverChange={setIsLogoHovered}
        visibilityPhase={isScattering ? "exit" : "enter"}
        pointerOverrideRef={logoPointerRef}
      />

      {sampled && sampled.count > 0 && (
        <points
          ref={pointsRef}
          geometry={pointsGeometry}
          material={pointsMaterial}
          frustumCulled={false}
        />
      )}
    </>
  );
}

function WelcomeWebGLStage({
  leadLine,
  firstName,
  assistantState,
  isDark,
  isMobile,
  isScattering,
  onScatterComplete,
}: {
  leadLine: string;
  firstName: string;
  assistantState: Logo3DState;
  isDark: boolean;
  isMobile: boolean;
  isScattering: boolean;
  onScatterComplete?: () => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointerNdcRef = useRef({ x: 0, y: 0, active: false });
  const touchDecayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]) setInView(entries[0].isIntersecting);
      },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => {
      setTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    return () => {
      if (touchDecayTimerRef.current) clearTimeout(touchDecayTimerRef.current);
    };
  }, []);

  const updatePointerFromClient = (clientX: number, clientY: number, isTouchTap = false) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    pointerNdcRef.current = { x: nx, y: ny, active: true };

    if (isTouchTap) {
      if (touchDecayTimerRef.current) clearTimeout(touchDecayTimerRef.current);
      touchDecayTimerRef.current = setTimeout(() => {
        pointerNdcRef.current.active = false;
      }, 420);
    }
  };

  const activeLoop = inView && tabVisible;

  return (
    <div
      ref={stageRef}
      aria-hidden="true"
      onPointerMove={(e) => updatePointerFromClient(e.clientX, e.clientY, false)}
      onPointerDown={(e) =>
        updatePointerFromClient(e.clientX, e.clientY, e.pointerType === "touch")
      }
      onPointerLeave={() => {
        pointerNdcRef.current.active = false;
      }}
      className="w-full max-w-[760px] h-[295px] sm:h-[365px] mx-auto relative select-none"
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 10], fov: 38 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        frameloop={activeLoop ? "always" : "never"}
        style={{ background: "transparent", width: "100%", height: "100%" }}
      >
        <Suspense fallback={null}>
          <WelcomeCanvasContent
            leadLine={leadLine}
            firstName={firstName}
            assistantState={assistantState}
            isDark={isDark}
            isMobile={isMobile}
            inView={activeLoop}
            isScattering={isScattering}
            onScatterComplete={onScatterComplete}
            pointerNdcRef={pointerNdcRef}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

export function WelcomeScene({
  leadLine,
  firstName,
  subtitle = "How can I help with your campus today?",
  suggestions,
  assistantState = "idle",
  isDark = true,
  isScattering = false,
  onScatterComplete,
  onSelectSuggestion,
  forceReducedMotion = false,
}: WelcomeSceneProps) {
  const osReducedMotion = Boolean(useReducedMotion());
  const prefersReducedMotion = osReducedMotion || forceReducedMotion;

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const isMobile = useSyncExternalStore(
    subscribeWindowResize,
    () => window.innerWidth < 640,
    () => false
  );
  const canUseWebGL = useSyncExternalStore(
    emptySubscribe,
    detectWebGLAvailable,
    () => true
  );
  const isLowPower = useSyncExternalStore(
    emptySubscribe,
    detectLowPowerDevice,
    () => false
  );

  const showStaticFallback = prefersReducedMotion || !canUseWebGL || isLowPower || !mounted;

  // Trigger scatter callback cleanly if static fallback is shown when sending first message
  useEffect(() => {
    if (showStaticFallback && isScattering && onScatterComplete) {
      const t = window.setTimeout(() => onScatterComplete(), 180);
      return () => window.clearTimeout(t);
    }
  }, [showStaticFallback, isScattering, onScatterComplete]);

  const staticFallbackView = (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: isScattering ? 0 : 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
      className="flex flex-col items-center text-center pt-4 pb-3 select-none"
    >
      <div className="mb-5">
        <BrandLogo
          variant="mark"
          isDark={isDark}
          size={isMobile ? 96 : 124}
          alt="CampVion Emblem"
          priority
          className="h-24 sm:h-32 w-auto"
        />
      </div>
      <div className="space-y-1">
        <p className="text-2xl sm:text-4xl font-semibold tracking-tight text-cv-fg">
          {leadLine}
        </p>
        <p className="text-4xl sm:text-5xl font-extrabold tracking-tight cv-gradient-text">
          {firstName}
        </p>
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col items-center justify-center text-center w-full max-w-3xl mx-auto px-4 my-auto">
      {/* Screen-reader accessible real heading */}
      <h1 className="sr-only">
        {leadLine} {firstName}
      </h1>

      {/* Centered 3D Logo + Dotted Greeting Stage (Transparent, Unboxed) */}
      {showStaticFallback ? (
        staticFallbackView
      ) : (
        <WelcomeCanvasErrorBoundary fallback={staticFallbackView}>
          <WelcomeWebGLStage
            leadLine={leadLine}
            firstName={firstName}
            assistantState={assistantState}
            isDark={isDark}
            isMobile={isMobile}
            isScattering={isScattering}
            onScatterComplete={onScatterComplete}
          />
        </WelcomeCanvasErrorBoundary>
      )}

      {/* One Muted Subtitle Line + 3 Slim Role-Aware Suggestion Pills */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={
          isScattering
            ? { opacity: 0, y: -8 }
            : { opacity: 1, y: 0 }
        }
        transition={{
          duration: prefersReducedMotion ? 0 : isScattering ? 0.35 : 0.45,
          delay: isScattering || prefersReducedMotion ? 0 : 0.25,
          ease: "easeOut",
        }}
        className="flex flex-col items-center space-y-4 mt-1 max-w-xl"
      >
        <p className="text-xs sm:text-sm text-cv-fg-2 font-normal">
          {subtitle}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {suggestions.slice(0, 3).map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={isScattering}
              onClick={() => onSelectSuggestion(item.prompt)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium glass-panel hover:border-cv-accent-line hover:text-cv-accent-ink text-cv-fg transition-all duration-150 cursor-pointer hover:-translate-y-0.5 disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
