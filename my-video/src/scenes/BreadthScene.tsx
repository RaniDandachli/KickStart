import React from "react";
import { useCurrentFrame, interpolate, Easing, AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/BebasNeue";

const { fontFamily: bebas } = loadFont();

const GAMES = [
  { emoji: "⚽", name: "KICK CLASH", sub: "SOCCER SHOWDOWN", color: "#22C55E", glow: "#16A34A" },
  { emoji: "🎯", name: "BULLSEYE", sub: "AIM CHALLENGE", color: "#3B82F6", glow: "#1D4ED8" },
  { emoji: "🏎️", name: "NITRO RUSH", sub: "SPEED RACING", color: "#F5A623", glow: "#D97706" },
];

export const BreadthScene: React.FC = () => {
  const frame = useCurrentFrame();

  // each game gets 11 frames
  const gameIdx = Math.min(Math.floor(frame / 11), 2);
  const localFrame = frame % 11;

  const scaleIn = interpolate(localFrame, [0, 5], [1.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(localFrame, [0, 2, 8, 11], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const game = GAMES[gameIdx];

  // "100+ GAMES" banner fades in after first flash
  const bannerOpacity = interpolate(frame, [8, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#05000F", overflow: "hidden" }}>
      {/* bg flash matching game color */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${game.color}22 0%, transparent 70%)`,
          opacity,
        }}
      />

      {/* game card */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          transform: `scale(${scaleIn})`,
          opacity,
        }}
      >
        {/* icon circle */}
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${game.color}44, ${game.color}11)`,
            border: `4px solid ${game.color}`,
            boxShadow: `0 0 60px ${game.glow}, 0 0 120px ${game.glow}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 130,
          }}
        >
          {game.emoji}
        </div>

        <div
          style={{
            fontFamily: bebas,
            fontSize: 100,
            color: "#FFFFFF",
            letterSpacing: "0.06em",
            textShadow: `0 0 40px ${game.color}, 0 6px 0 rgba(0,0,0,0.6)`,
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {game.name}
        </div>
        <div
          style={{
            fontFamily: bebas,
            fontSize: 44,
            color: game.color,
            letterSpacing: "0.14em",
          }}
        >
          {game.sub}
        </div>
      </div>

      {/* "100+ MINI-GAMES" banner at bottom */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 220,
          textAlign: "center",
          opacity: bannerOpacity,
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(155,48,255,0.2)",
            border: "2px solid rgba(155,48,255,0.5)",
            borderRadius: 60,
            padding: "16px 60px",
          }}
        >
          <div
            style={{
              fontFamily: bebas,
              fontSize: 52,
              color: "#CC55FF",
              letterSpacing: "0.12em",
            }}
          >
            100+ MINI-GAMES
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
