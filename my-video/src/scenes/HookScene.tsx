import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
  Img,
  staticFile,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/BebasNeue";

const { fontFamily: bebas } = loadFont();

const rand = (seed: number) =>
  ((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;

const SPARKS = Array.from({ length: 14 }, (_, i) => ({
  angle: (i / 14) * Math.PI * 2,
  dist: 280 + rand(i + 99) * 120,
  size: 6 + rand(i + 55) * 10,
  color: rand(i) > 0.5 ? "#F5A623" : "#CC55FF",
}));

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── horizontal neon streak (frame 2–16) ──────────────────────────
  const streakProgress = interpolate(frame, [2, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const streakOpacity = interpolate(frame, [2, 6, 10, 16], [0, 1, 0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const streakX = -700 + streakProgress * (1080 + 700);

  // ── logo spring slam (starts frame 8) ────────────────────────────
  const logoScale = spring({
    fps,
    frame: Math.max(0, frame - 8),
    config: { damping: 11, stiffness: 280, mass: 0.7 },
    from: 3.2,
    to: 1,
  });
  const logoOpacity = interpolate(frame, [8, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoY = spring({
    fps,
    frame: Math.max(0, frame - 8),
    config: { damping: 11, stiffness: 280, mass: 0.7 },
    from: -420,
    to: 0,
  });

  // ── shockwave ring on logo impact (frame 18) ─────────────────────
  const ringProgress = interpolate(frame, [18, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringScale = 0.3 + ringProgress * 2.2;
  const ringOpacity = interpolate(frame, [18, 22, 36], [0.9, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── spark burst at impact (frame 18-32) ──────────────────────────
  const sparkProgress = interpolate(frame, [18, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sparkOpacity = interpolate(frame, [18, 22, 32], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── headline text (frame 30-44) ───────────────────────────────────
  const textOpacity = interpolate(frame, [30, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [30, 38], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const CX = 540;
  const CY = 820;

  return (
    <AbsoluteFill
      style={{ backgroundColor: "#05000F", overflow: "hidden" }}
    >
      {/* neon streak */}
      <div
        style={{
          position: "absolute",
          top: CY - 3,
          left: streakX,
          width: 700,
          height: 6,
          background:
            "linear-gradient(90deg, transparent, #9B30FF 20%, #FFFFFF 50%, #9B30FF 80%, transparent)",
          opacity: streakOpacity,
          filter: "blur(2px)",
          boxShadow: "0 0 24px 8px #7B21E8",
        }}
      />

      {/* shockwave ring */}
      <div
        style={{
          position: "absolute",
          left: CX - 300,
          top: CY - 300,
          width: 600,
          height: 600,
          borderRadius: "50%",
          border: "4px solid #9B30FF",
          boxShadow: "0 0 30px 6px #7B21E8, inset 0 0 30px 6px #7B21E8",
          transform: `scale(${ringScale})`,
          opacity: ringOpacity,
        }}
      />

      {/* impact sparks */}
      {SPARKS.map((s, i) => {
        const px = CX + Math.cos(s.angle) * s.dist * sparkProgress;
        const py = CY + Math.sin(s.angle) * s.dist * sparkProgress;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px - s.size / 2,
              top: py - s.size / 2,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              backgroundColor: s.color,
              opacity: sparkOpacity,
              boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
            }}
          />
        );
      })}

      {/* logo */}
      <div
        style={{
          position: "absolute",
          left: CX - 380,
          top: CY - 380 + logoY,
          width: 760,
          height: 760,
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          transformOrigin: "center center",
          filter: `drop-shadow(0 0 40px #9B30FF) drop-shadow(0 0 80px #7B21E8)`,
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* headline */}
      <div
        style={{
          position: "absolute",
          bottom: 340,
          left: 60,
          right: 60,
          textAlign: "center",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: bebas,
            fontSize: 88,
            color: "#FFFFFF",
            letterSpacing: "0.04em",
            lineHeight: 1,
            textShadow:
              "0 0 40px rgba(155, 48, 255, 0.9), 0 6px 0 rgba(0,0,0,0.6)",
          }}
        >
          YOU'VE GOT 10 SECONDS.
        </div>
      </div>
    </AbsoluteFill>
  );
};
