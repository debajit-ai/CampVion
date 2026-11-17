import Image from "next/image";

export interface BrandLogoProps {
  /** `"mark"` renders the crisp vector shield emblem; `"lockup"` renders shield + wordmark + tagline PNG. */
  variant?: "mark" | "lockup";
  /** Explicitly pin dark or light surface contrast; omit to follow CSS `.dark` theme automatically. */
  isDark?: boolean;
  /** Render pixel width hint for mark (aspect 684:928) or lockup (aspect 1356:1339). */
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
}

const MARK_DIMS = { width: 684, height: 928 };
const LOCKUP_DIMS = { width: 1356, height: 1339 };

export function BrandLogo({
  variant = "mark",
  isDark,
  size,
  className = "",
  alt,
  priority = false,
}: BrandLogoProps) {
  const dims = variant === "lockup" ? LOCKUP_DIMS : MARK_DIMS;
  const darkSurfaceSrc =
    variant === "lockup"
      ? "/brand/campvion-lockup-white.png"
      : "/brand/campvion-mark-white.svg";
  const lightSurfaceSrc =
    variant === "lockup"
      ? "/brand/campvion-lockup-dark.png"
      : "/brand/campvion-mark-dark.svg";

  const label =
    alt ??
    (variant === "lockup"
      ? "CampVion — Autonomous University AI Platform"
      : "CampVion Emblem");

  const width =
    size ??
    (variant === "lockup" ? 160 : 28);
  const height = Math.round((width * dims.height) / dims.width);

  const hasSizeClass = /\b(w-|h-)/.test(className);
  const sizingClass = hasSizeClass ? className : `h-auto w-auto ${className}`;

  if (typeof isDark === "boolean") {
    const src = isDark ? darkSurfaceSrc : lightSurfaceSrc;
    return (
      <Image
        src={src}
        alt={label}
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className={`max-h-full max-w-full object-contain select-none ${sizingClass}`}
      />
    );
  }

  // Automatic CSS theme pair (avoids hydration mismatch or flicker)
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Image
        src={lightSurfaceSrc}
        alt={label}
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className="block dark:hidden max-h-full max-w-full h-full w-auto object-contain select-none"
      />
      <Image
        src={darkSurfaceSrc}
        alt={label}
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className="hidden dark:block max-h-full max-w-full h-full w-auto object-contain select-none"
      />
    </span>
  );
}
