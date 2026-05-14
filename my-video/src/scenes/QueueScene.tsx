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

const DOTS = [".", ".", "."];
const RING_DELAYS = [0, 6, 12];

export const QueueScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // scene fade-in
  const sceneOpacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // pulsing rings (continuous, staggered)
  const getRingState = (delay: number) => {
    const t = (frame - delay + 999) % 24;
    const scale = interpolate(t, [0, 22], [0.4, 2.8], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    const opacity = interpolate(t, [0, 8, 22], [0.8, 0.4, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return { scale, opacity };
  };

  // button glow pulse
  const glowIntensity = 0.6 + Math.sin(frame * 0.3) * 0.4;

  // thumb tap animation (frames 10–26)
  const thumbY = spring({
    fps,
    frame: Math.max(0, (frame - 10) % 16),
    config: { damping: 8, stiffness: 400 },
    from: 0,
    to: frame >= 10 && frame <= 26 ? 28 : 0,
  });

  // "FINDING OPPONENT" dots blinking
  const dotOpacity = (i: number) =>
    interpolate(((frame + i * 6) % 18), [0, 6, 12, 18], [0.2, 1, 1, 0.2], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // player count ticker
  const count = 2847 + Math.floor(frame * 1.7);

  // online bar fill
  const barWidth = interpolate(frame, [0, 28], [0, 420], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const CX = 540;
  const CY = 960;

  return (
    <AbsoluteFill
      style={{ backgroundColor: "#09001A", overflow: "hidden", opacity: sceneOpacity }}
    >
      {/* background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(155,48,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(155,48,255,0.07) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* pulsing rings behind button */}
      {RING_DELAYS.map((delay, i) => {
        const { scale, opacity } = getRingState(delay);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: CX - 140,
              top: CY - 140,
              width: 280,
              height: 280,
              borderRadius: "50%",
              border: `2px solid #9B30FF`,
              opacity,
              transform: `scale(${scale})`,
            }}
          />
        );
      })}

      {/* FIND MATCH button */}
      <div
        style={{
          position: "absolute",
          left: CX - 200,
          top: CY - 56,
          width: 400,
          height: 112,
          borderRadius: 56,
          background: `linear-gradient(135deg, #9B30FF, #6A0FC7)`,
          boxShadow: `0 0 ${40 * glowIntensity}px ${20 * glowIntensity}px rgba(155,48,255,0.6), inset 0 2px 0 rgba(255,255,255,0.2)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: bebas,
            fontSize: 52,
            color: "#FFFFFF",
            letterSpacing: "0.1em",
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          FIND MATCH
        </div>
      </div>

      {/* thumb tap */}
      <div
        style={{
          position: "absolute",
          left: CX - 30,
          top: CY + 70 + thumbY,
          fontSize: 64,
          filter: "drop-shadow(0 4px 12px rgba(155,48,255,0.6))",
          transform: `scale(${1 - thumbY * 0.003})`,
        }}
      >
        👆
      </div>

      {/* FINDING OPPONENT text */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: CY + 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <div
          style={{
            fontFamily: bebas,
            fontSize: 44,
            color: "#CC55FF",
            letterSpacing: "0.12em",
          }}
        >
          FINDING OPPONENT
        </div>
        {DOTS.map((_, i) => (
          <div
            key={i}
            style={{
              fontFamily: bebas,
              fontSize: 44,
              color: "#CC55FF",
              opacity: dotOpacity(i),
              lineHeight: 1,
            }}
          >
            .
          </div>
        ))}
      </div>

      {/* online count */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: CY + 270,
          textAlign: "center",
          fontFamily: bebas,
          fontSize: 32,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: "0.08em",
        }}
      >
        ⚡ {count.toLocaleString()} PLAYERS ONLINE
      </div>

      {/* tension bar */}
      <div
        style={{
          position: "absolute",
          left: CX - 210,
          top: CY + 340,
          width: 420,
          height: 6,
          borderRadius: 3,
          backgroundColor: "rgba(155,48,255,0.2)",
        }}
      >
        <div
          style={{
            width: barWidth,
            height: "100%",
            borderRadius: 3,
            background: "linear-gradient(90deg, #7B21E8, #CC55FF, #F5A623)",
            boxShadow: "0 0 10px #9B30FF",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
