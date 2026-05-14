import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/BebasNeue";

const { fontFamily: bebas } = loadFont();

const rand = (seed: number) =>
  ((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;

const CONFETTI = Array.from({ length: 40 }, (_, i) => ({
  x: rand(i) * 1080,
  vy: rand(i + 1) * 25 + 10,
  vx: (rand(i + 2) - 0.5) * 12,
  size: 10 + rand(i + 3) * 18,
  color:
    [
      "#F5A623",
      "#CC55FF",
      "#FFFFFF",
      "#9B30FF",
      "#FFD700",
      "#FF5080",
    ][Math.floor(rand(i + 4) * 6)],
  rotation: rand(i + 5) * 360,
  rotationSpeed: (rand(i + 6) - 0.5) * 12,
  shape: rand(i + 7) > 0.5 ? "50%" : "3px",
  delay: Math.floor(rand(i + 8) * 12),
}));

export const WinScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── flash white on entry ──────────────────────────────────────────
  const flashOpacity = interpolate(frame, [0, 2, 8], [1, 0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── "W" slam ──────────────────────────────────────────────────────
  const wScale = spring({
    fps,
    frame: Math.max(0, frame - 2),
    config: { damping: 10, stiffness: 320, mass: 0.7 },
    from: 4,
    to: 1,
  });
  const wOpacity = interpolate(frame, [2, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wGlow = 0.5 + Math.sin(frame * 0.4) * 0.5;

  // ── crown icon ────────────────────────────────────────────────────
  const crownScale = spring({
    fps,
    frame: Math.max(0, frame - 10),
    config: { damping: 12, stiffness: 300 },
    from: 0,
    to: 1,
  });

  // ── WINNER text ───────────────────────────────────────────────────
  const winnerOpacity = interpolate(frame, [14, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const winnerY = interpolate(frame, [14, 20], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // ── rank up badge ─────────────────────────────────────────────────
  const rankOpacity = interpolate(frame, [20, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rankX = interpolate(frame, [20, 28], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });

  // ── points badge ──────────────────────────────────────────────────
  const pointsOpacity = interpolate(frame, [22, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 40%, #2A0060 0%, #0A0015 70%)",
        overflow: "hidden",
      }}
    >
      {/* flash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#FFFFFF",
          opacity: flashOpacity,
          pointerEvents: "none",
        }}
      />

      {/* confetti */}
      {CONFETTI.map((c, i) => {
        const t = Math.max(0, frame - c.delay);
        const gravity = 0.5;
        const px = c.x + c.vx * t;
        const py = -20 + c.vy * t + gravity * t * t * 0.3;
        const opacity = interpolate(frame - c.delay, [0, 5, 28, 33], [0, 1, 0.8, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: c.size,
              height: c.size,
              borderRadius: c.shape,
              backgroundColor: c.color,
              opacity,
              transform: `rotate(${c.rotation + c.rotationSpeed * frame}deg)`,
              boxShadow: `0 0 ${c.size * 0.8}px ${c.color}`,
            }}
          />
        );
      })}

      {/* ambient glow */}
      <div
        style={{
          position: "absolute",
          left: 540 - 400,
          top: 700,
          width: 800,
          height: 800,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(245,166,35,0.3) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* crown */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 500,
          textAlign: "center",
          fontSize: 140,
          transform: `scale(${crownScale})`,
          transformOrigin: "center bottom",
          filter: "drop-shadow(0 0 30px #F5A623) drop-shadow(0 0 60px rgba(245,166,35,0.5))",
        }}
      >
        👑
      </div>

      {/* big W */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 650,
          textAlign: "center",
          opacity: wOpacity,
          transform: `scale(${wScale})`,
          transformOrigin: "center top",
        }}
      >
        <div
          style={{
            fontFamily: bebas,
            fontSize: 480,
            color: "#F5A623",
            lineHeight: 0.85,
            textShadow: `0 0 ${80 * wGlow}px rgba(245,166,35,0.9), 0 0 ${160 * wGlow}px rgba(245,166,35,0.4), 0 12px 0 rgba(0,0,0,0.7)`,
          }}
        >
          W
        </div>
      </div>

      {/* WINNER text */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1260,
          textAlign: "center",
          opacity: winnerOpacity,
          transform: `translateY(${winnerY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: bebas,
            fontSize: 96,
            color: "#FFFFFF",
            letterSpacing: "0.15em",
            textShadow: "0 0 40px rgba(155,48,255,0.8), 0 4px 0 rgba(0,0,0,0.5)",
          }}
        >
          WINNER
        </div>
      </div>

      {/* RANK UP badge */}
      <div
        style={{
          position: "absolute",
          left: 100 + rankX,
          top: 1400,
          opacity: rankOpacity,
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "linear-gradient(135deg, #9B30FF, #6A0FC7)",
          borderRadius: 50,
          padding: "14px 32px",
          boxShadow: "0 0 24px rgba(155,48,255,0.6)",
        }}
      >
        <div style={{ fontSize: 40 }}>⬆️</div>
        <div
          style={{
            fontFamily: bebas,
            fontSize: 52,
            color: "#FFFFFF",
            letterSpacing: "0.08em",
          }}
        >
          RANK UP!
        </div>
      </div>

      {/* +50 PTS badge */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 1400,
          opacity: pointsOpacity,
          background: "rgba(245,166,35,0.15)",
          border: "2px solid rgba(245,166,35,0.6)",
          borderRadius: 50,
          padding: "14px 32px",
          boxShadow: "0 0 20px rgba(245,166,35,0.3)",
        }}
      >
        <div
          style={{
            fontFamily: bebas,
            fontSize: 52,
            color: "#F5A623",
            letterSpacing: "0.08em",
          }}
        >
          +50 PTS
        </div>
      </div>
    </AbsoluteFill>
  );
};
