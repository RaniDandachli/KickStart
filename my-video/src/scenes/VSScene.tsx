import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing, AbsoluteFill, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/BebasNeue";

const { fontFamily: bebas } = loadFont();

export const VSScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const p1X = spring({ fps, frame: Math.max(0, frame - 3), config: { damping: 14, stiffness: 260 }, from: -500, to: 0 });
  const p2X = spring({ fps, frame: Math.max(0, frame - 3), config: { damping: 14, stiffness: 260 }, from: 500, to: 0 });
  const vsScale = spring({ fps, frame: Math.max(0, frame - 6), config: { damping: 9, stiffness: 350, mass: 0.6 }, from: 3, to: 1 });
  const vsGlow = 0.5 + Math.sin(frame * 0.4) * 0.5;

  const liveOpacity = interpolate(frame, [15, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const livePulse = 0.7 + Math.sin(frame * 0.6) * 0.3;
  const talkOpacity = interpolate(frame, [22, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const CX = 540;
  const CY = 960;

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: sceneOpacity }}>
      {/* bg halves */}
      <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", background: "linear-gradient(160deg, #1A0040 0%, #0D001E 100%)" }} />
      <div style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%", background: "linear-gradient(200deg, #2A0010 0%, #0D0005 100%)" }} />

      {/* split line */}
      <div style={{ position: "absolute", left: CX - 2, top: 0, bottom: 0, width: 4, background: "linear-gradient(180deg, transparent, #CC55FF 20%, #FFFFFF 50%, #CC55FF 80%, transparent)", boxShadow: "0 0 20px 4px #9B30FF" }} />

      {/* player 1 card */}
      <div style={{ position: "absolute", left: 40 + p1X, top: CY - 280, width: 400, height: 560, borderRadius: 24, background: "linear-gradient(160deg, rgba(155,48,255,0.2), rgba(155,48,255,0.05))", border: "2px solid rgba(155,48,255,0.5)", boxShadow: "0 0 30px rgba(155,48,255,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 32 }}>
        <div style={{ width: 140, height: 140, borderRadius: "50%", background: "linear-gradient(135deg, #9B30FF, #6A0FC7)", border: "4px solid #CC55FF", boxShadow: "0 0 30px rgba(155,48,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🎮</div>
        <div style={{ fontFamily: bebas, fontSize: 52, color: "#FFFFFF", letterSpacing: "0.06em" }}>KILLERZ_X</div>
        <div style={{ fontFamily: bebas, fontSize: 36, color: "#F5A623", letterSpacing: "0.08em" }}>★ DIAMOND</div>
        <div style={{ fontFamily: bebas, fontSize: 80, color: "#FFFFFF", textShadow: "0 0 30px rgba(155,48,255,0.8)" }}>7</div>
        <div style={{ fontFamily: bebas, fontSize: 28, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>WINS TODAY</div>
      </div>

      {/* player 2 card */}
      <div style={{ position: "absolute", right: 40 - p2X, top: CY - 280, width: 400, height: 560, borderRadius: 24, background: "linear-gradient(200deg, rgba(255,40,80,0.2), rgba(255,40,80,0.05))", border: "2px solid rgba(255,40,80,0.5)", boxShadow: "0 0 30px rgba(255,40,80,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 32 }}>
        <div style={{ width: 140, height: 140, borderRadius: "50%", background: "linear-gradient(135deg, #FF2850, #AA0020)", border: "4px solid #FF5070", boxShadow: "0 0 30px rgba(255,40,80,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🔥</div>
        <div style={{ fontFamily: bebas, fontSize: 52, color: "#FFFFFF", letterSpacing: "0.06em" }}>SPEEDRN_99</div>
        <div style={{ fontFamily: bebas, fontSize: 36, color: "#F5A623", letterSpacing: "0.08em" }}>★★ GOLD</div>
        <div style={{ fontFamily: bebas, fontSize: 80, color: "#FFFFFF", textShadow: "0 0 30px rgba(255,40,80,0.8)" }}>5</div>
        <div style={{ fontFamily: bebas, fontSize: 28, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>WINS TODAY</div>
      </div>

      {/* VS */}
      <div style={{ position: "absolute", left: CX - 90, top: CY - 100, width: 180, height: 200, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${vsScale})`, transformOrigin: "center center" }}>
        <div style={{ fontFamily: bebas, fontSize: 150, color: "#FFFFFF", textShadow: `0 0 ${60 * vsGlow}px rgba(255,255,255,0.9), 0 0 ${120 * vsGlow}px rgba(155,48,255,0.7), 0 6px 0 rgba(0,0,0,0.8)`, lineHeight: 1 }}>VS</div>
      </div>

      {/* LIVE pill */}
      <div style={{ position: "absolute", left: CX - 70, top: 180, opacity: liveOpacity, display: "flex", alignItems: "center", gap: 10, backgroundColor: "rgba(0,0,0,0.6)", border: "2px solid rgba(255,80,80,0.6)", borderRadius: 40, padding: "10px 28px" }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#FF3030", boxShadow: `0 0 ${12 * livePulse}px ${6 * livePulse}px rgba(255,48,48,0.7)` }} />
        <div style={{ fontFamily: bebas, fontSize: 36, color: "#FF5050", letterSpacing: "0.12em" }}>LIVE</div>
      </div>

      {/* trash talk */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 260, textAlign: "center", opacity: talkOpacity, fontFamily: bebas, fontSize: 52, color: "rgba(255,255,255,0.85)", letterSpacing: "0.06em", textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>
        GG EZ 💀
      </div>
    </AbsoluteFill>
  );
};
