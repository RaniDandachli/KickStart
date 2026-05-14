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

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  x: 200 + rand(i) * 680,
  y: 800 + rand(i + 1) * 400,
  vx: (rand(i + 2) - 0.5) * 18,
  vy: -(rand(i + 3) * 28 + 12),
  size: 8 + rand(i + 4) * 16,
  color: rand(i + 5) > 0.6 ? "#F5A623" : rand(i + 6) > 0.5 ? "#CC55FF" : "#FFFFFF",
  rotation: rand(i + 7) * 360,
  shape: rand(i + 8) > 0.5 ? "50%" : "4px",
}));

const SCORE_NUMBERS = ["+247", "+183", "+312", "+96"];

export const GameplayScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── screen flash on entry ─────────────────────────────────────────
  const flashOpacity = interpolate(frame, [0, 2, 6], [1, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── screen shake (frames 3–18) ────────────────────────────────────
  const isShaking = frame >= 3 && frame <= 18;
  const shakeX = isShaking ? Math.sin(frame * 13.7) * 8 * Math.max(0, 1 - frame * 0.04) : 0;
  const shakeY = isShaking ? Math.cos(frame * 11.3) * 5 * Math.max(0, 1 - frame * 0.04) : 0;

  // ── big score number ──────────────────────────────────────────────
  const score = Math.floor(interpolate(frame, [0, 30], [1247, 1894], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  }));

  const scoreScale = spring({
    fps,
    frame: Math.max(0, frame - 2),
    config: { damping: 12, stiffness: 320 },
    from: 1.8,
    to: 1,
  });

  // ── COMBO slam (frame 6–22) ───────────────────────────────────────
  const comboScale = spring({
    fps,
    frame: Math.max(0, frame - 6),
    config: { damping: 10, stiffness: 380, mass: 0.6 },
    from: 0,
    to: 1,
  });
  const comboX = interpolate(frame, [6, 16], [400, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // ── floating score popups ─────────────────────────────────────────
  const getPopup = (i: number) => {
    const startFrame = i * 7;
    const t = frame - startFrame;
    const opacity = interpolate(t, [0, 3, 10, 16], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const y = interpolate(t, [0, 16], [0, -120], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    return { opacity, y };
  };

  // ── particles ─────────────────────────────────────────────────────
  const particleOpacity = interpolate(frame, [3, 7, 24, 33], [0, 1, 0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── bg color sweep ────────────────────────────────────────────────
  const bgShift = interpolate(frame, [0, 33], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: `linear-gradient(160deg, #0D0025 0%, #1A0040 ${40 + bgShift * 20}%, #0D0025 100%)`,
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      {/* flash overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#FFFFFF",
          opacity: flashOpacity,
          pointerEvents: "none",
        }}
      />

      {/* ambient glow circle behind score */}
      <div
        style={{
          position: "absolute",
          left: 540 - 300,
          top: 700,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(155,48,255,0.35) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* particles */}
      {PARTICLES.map((p, i) => {
        const gravity = 0.3;
        const px = p.x + p.vx * frame;
        const py = p.y + p.vy * frame + gravity * frame * frame * 0.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px - p.size / 2,
              top: py - p.size / 2,
              width: p.size,
              height: p.size,
              borderRadius: p.shape,
              backgroundColor: p.color,
              opacity: particleOpacity * (0.6 + rand(i) * 0.4),
              transform: `rotate(${p.rotation + frame * rand(i + 9) * 8}deg)`,
              boxShadow: `0 0 ${p.size}px ${p.color}`,
            }}
          />
        );
      })}

      {/* floating score popups */}
      {SCORE_NUMBERS.map((num, i) => {
        if (i >= 4) return null;
        const { opacity, y } = getPopup(i);
        const startX = 180 + i * 200;
        const startY = 900 - i * 60;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: startX,
              top: startY + y,
              fontFamily: bebas,
              fontSize: 52,
              color: "#F5A623",
              opacity,
              textShadow: "0 0 20px #F5A623, 0 0 40px rgba(245,166,35,0.5)",
              letterSpacing: "0.04em",
            }}
          >
            {num}
          </div>
        );
      })}

      {/* main score */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 680,
          textAlign: "center",
          transform: `scale(${scoreScale})`,
          transformOrigin: "center top",
        }}
      >
        <div
          style={{
            fontFamily: bebas,
            fontSize: 200,
            color: "#FFFFFF",
            letterSpacing: "0.02em",
            lineHeight: 0.9,
            textShadow:
              "0 0 60px rgba(155,48,255,0.8), 0 0 120px rgba(155,48,255,0.4), 0 8px 0 rgba(0,0,0,0.6)",
          }}
        >
          {score.toLocaleString()}
        </div>
        <div
          style={{
            fontFamily: bebas,
            fontSize: 40,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.15em",
          }}
        >
          POINTS
        </div>
      </div>

      {/* COMBO badge */}
      <div
        style={{
          position: "absolute",
          left: 60 + comboX,
          top: 1020,
          transform: `scale(${comboScale})`,
          transformOrigin: "left center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            background:
              "linear-gradient(135deg, #F5A623 0%, #FF6B00 100%)",
            borderRadius: 16,
            padding: "10px 28px",
            boxShadow: "0 0 30px rgba(245,166,35,0.7), 0 4px 0 rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              fontFamily: bebas,
              fontSize: 64,
              color: "#FFFFFF",
              letterSpacing: "0.06em",
              textShadow: "0 2px 0 rgba(0,0,0,0.3)",
            }}
          >
            COMBO ×3!
          </div>
        </div>
      </div>

      {/* "TAP TO DODGE" micro-instruction */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1140,
          textAlign: "center",
          fontFamily: bebas,
          fontSize: 36,
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.15em",
        }}
      >
        TAP TO DODGE
      </div>
    </AbsoluteFill>
  );
};
