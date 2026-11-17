import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "CampVion AI — Autonomous Campus Operations Platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

async function loadWhiteLockupDataUrl(): Promise<string> {
  const lockupPath = path.join(
    process.cwd(),
    "public",
    "brand",
    "campvion-lockup-white.png"
  );
  const buffer = await readFile(lockupPath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export default async function OpenGraphImage() {
  const lockupSrc = await loadWhiteLockupDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "56px 64px",
          backgroundColor: "#05070F",
          color: "#F5F7FF",
          fontFamily: "system-ui, sans-serif",
          backgroundImage:
            "radial-gradient(circle at 22% 18%, rgba(99,102,241,0.34), transparent 45%), radial-gradient(circle at 82% 76%, rgba(34,211,238,0.26), transparent 48%)",
          gap: "48px",
        }}
      >
        {/* Left: Copy + Badges */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "8px 18px",
              borderRadius: "9999px",
              backgroundColor: "rgba(11, 16, 32, 0.9)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              fontSize: "15px",
              fontWeight: 700,
              color: "#38BDF8",
              letterSpacing: "0.08em",
            }}
          >
            AUTONOMOUS CAMPUS OPERATIONS
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: "58px",
                fontWeight: 900,
                lineHeight: 1.06,
                letterSpacing: "-0.02em",
              }}
            >
              <span>ONE PLATFORM.</span>
              <span style={{ color: "#38BDF8" }}>ALL CAMPUS SERVICES.</span>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "22px",
                color: "#8B95B0",
                maxWidth: "660px",
                lineHeight: 1.4,
              }}
            >
              Natural language intent parsing, deterministic DAG planning,
              institutional policy verification, and human-governed execution.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: "14px",
                backgroundColor: "#0B1020",
                border: "1px solid rgba(56,189,248,0.35)",
                color: "#38BDF8",
              }}
            >
              Intent Parser
            </div>
            <div
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: "14px",
                backgroundColor: "#0B1020",
                border: "1px solid rgba(52,211,153,0.35)",
                color: "#34D399",
              }}
            >
              100% Policy-Verified
            </div>
            <div
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: "14px",
                backgroundColor: "#0B1020",
                border: "1px solid rgba(251,191,36,0.35)",
                color: "#FBBF24",
              }}
            >
              Human-in-the-loop Gate
            </div>
          </div>
        </div>

        {/* Right: Official White Lockup Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "340px",
            height: "360px",
            borderRadius: "28px",
            backgroundColor: "rgba(11, 16, 32, 0.78)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            padding: "28px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lockupSrc}
            alt="CampVion"
            width={284}
            height={280}
            style={{ objectFit: "contain" }}
          />
        </div>
      </div>
    ),
    size
  );
}
