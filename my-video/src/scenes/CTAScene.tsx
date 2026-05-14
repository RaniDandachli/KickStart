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

const BG_PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  x: rand(i) * 1080,
  y: rand(i + 1) * 1920,
  size: 4 + rand(i + 2) * 10,
  speed: 0.4 + rand(i + 3) * 0.8,
  color: rand(i + 4) > 0.5 ? "#9B30FF" : "#F5A623",
}));

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── bg fade in ────────────────────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── logo spring ───────────────────────────────────────────────────
  const logoScale = spring({
    fps,
    frame: Math.max(0, frame - 8),
    config: { damping: 13, stiffness: 240 },
    from: 0.3,
    to: 1,
  });
  const logoOpacity = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoGlow = 0.5 + Math.sin(frame * 0.25) * 0.3;

  // ── main tagline ──────────────────────────────────────────────────
  const tagOpacity = interpolate(frame, [28, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const tagY = interpolate(frame, [28, 40], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // ── sub line ──────────────────────────────────────────────────────
  const subOpacity = interpolate(frame, [40, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── divider line ──────────────────────────────────────────────────
  const dividerW = interpolate(frame, [50, 65], [0, 800], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // ── app store buttons ─────────────────────────────────────────────
  const btnOpacity = interpolate(frame, [58, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const btnY = interpolate(frame, [58, 72], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.5)),
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* gradient bg */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 35%, #3A0080 0%, #1A0040 35%, #0A0015 100%)",
          opacity: bgOpacity,
        }}
      />

      {/* subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(155,48,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(155,48,255,0.06) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          opacity: bgOpacity,
        }}
      />

      {/* floating particles */}
      {BG_PARTICLES.map((p, i) => {
        const py = ((p.y - p.speed * frame * 40) % 1980 + 1980) % 1980;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: py,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: p.color,
              opacity: 0.25 * bgOpacity,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            }}
          />
        );
      })}

      {/* logo */}
      <div
        style={{
          position: "absolute",
          left: 540 - 340,
          top: 260,
          width: 680,
          height: 680,
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          transformOrigin: "center center",
          filter: `drop-shadow(0 0 ${50 * logoGlow}px #9B30FF) drop-shadow(0 0 ${100 * logoGlow}px rgba(155,48,255,0.4))`,
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* main tagline */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 980,
          textAlign: "center",
          opacity: tagOpacity,
          transform: `translateY(${tagY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: bebas,
            fontSize: 72,
            color: "#FFFFFF",
            letterSpacing: "0.04em",
            lineHeight: 1.1,
            textShadow: "0 0 40px rgba(155,48,255,0.7), 0 4px 0 rgba(0,0,0,0.5)",
          }}
        >
          PICK A GAME.<br />GET MATCHED.<br />RUN IT.
        </div>
      </div>

      {/* divider */}
      <div
        style={{
          position: "absolute",
          left: 540 - dividerW / 2,
          top: 1290,
          width: dividerW,
          height: 2,
          background:
            "linear-gradient(90deg, transparent, #9B30FF 20%, #CC55FF 50%, #9B30FF 80%, transparent)",
          boxShadow: "0 0 8px #9B30FF",
        }}
      />

      {/* sub line */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 1310,
          textAlign: "center",
          opacity: subOpacity,
          fontFamily: bebas,
          fontSize: 38,
          color: "rgba(204,85,255,0.8)",
          letterSpacing: "0.1em",
        }}
      >
        CASUAL QUEUES • LIVE MATCHES • TOURNAMENTS
      </div>

      {/* App Store button */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 1420 + btnY,
          width: 440,
          height: 110,
          opacity: btnOpacity,
          borderRadius: 20,
          background: "#000000",
          border: "2px solid rgba(255,255,255,0.3)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "0 28px",
        }}
      >
        <div style={{ fontSize: 54 }}>🍎</div>
        <div>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 22, color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}>Download on the</div>
          <div style={{ fontFamily: bebas, fontSize: 44, color: "#FFFFFF", letterSpacing: "0.04em", lineHeight: 1 }}>APP STORE</div>
        </div>
      </div>

      {/* Google Play button */}
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 1420 + btnY,
          width: 440,
          height: 110,
          opacity: btnOpacity,
          borderRadius: 20,
          background: "#000000",
          border: "2px solid rgba(255,255,255,0.3)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "0 28px",
        }}
      >
        <div style={{ fontSize: 54 }}>▶️</div>
        <div>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 22, color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}>Get it on</div>
          <div style={{ fontFamily: bebas, fontSize: 44, color: "#FFFFFF", letterSpacing: "0.04em", lineHeight: 1 }}>GOOGLE PLAY</div>
        </div>
      </div>

      {/* logo watermark hold */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 120,
          textAlign: "center",
          opacity: btnOpacity * 0.5,
          fontFamily: bebas,
          fontSize: 28,
          color: "rgba(155,48,255,0.6)",
          letterSpacing: "0.15em",
        }}
      >
        RUNITARCADE.COM
      </div>
    </AbsoluteFill>
  );
};
