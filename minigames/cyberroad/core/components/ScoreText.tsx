// @ts-nocheck
import React from "react";
import { StyleSheet, Text, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GameContext from "../context/GameContext";
import { CyberRoadUi } from "../uiTheme";

function generateTextShadow(width) {
  return Platform.select({
    web: {
      textShadow: `-${width}px 0px 0px #000, ${width}px 0px 0px #000, 0px -${width}px 0px #000, 0px ${width}px 0px #000`,
    },
    default: {},
  });
}
const textShadow = generateTextShadow(3);

/** HUD: top-right chip stack — layout differs from template left-stack score. */
export default function Score({ gameOver, score, ...props }) {
  const { highscore = 0, setHighscore } = React.useContext(GameContext);

  React.useEffect(() => {
    if (gameOver) {
      if (score > highscore) {
        setHighscore(score);
      }
    }
  }, [gameOver]);

  const { top, right } = useSafeAreaInsets();

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top: Math.max(top, 12),
          right: Math.max(right, 12),
        },
      ]}
    >
      <View style={styles.chip}>
        <Text style={styles.label}>RUN</Text>
        <Text style={[styles.score, textShadow]}>{score}</Text>
      </View>
      {highscore > 0 && (
        <View style={[styles.chip, styles.chipSecondary]}>
          <Text style={styles.labelBest}>BEST RUN</Text>
          <Text style={[styles.highscore, textShadow]}>{highscore}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignItems: "flex-end",
    gap: 10,
  },
  chip: {
    minWidth: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: CyberRoadUi.radiusChip,
    backgroundColor: "rgba(8, 6, 20, 0.88)",
    borderWidth: 2,
    borderColor: CyberRoadUi.accentCyan,
    alignItems: "flex-end",
    ...Platform.select({
      ios: {
        shadowColor: "#00f5ff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
      web: {
        boxShadow: "0 0 14px rgba(0, 245, 255, 0.35)",
      },
      default: {},
    }),
  },
  chipSecondary: {
    borderColor: CyberRoadUi.accentMagenta,
    backgroundColor: "rgba(28, 6, 32, 0.88)",
    ...Platform.select({
      ios: {
        shadowColor: "#ff2bd6",
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      web: {
        boxShadow: "0 0 14px rgba(255, 43, 214, 0.32)",
      },
      default: {},
    }),
  },
  label: {
    fontFamily: "retro",
    fontSize: 9,
    letterSpacing: 3,
    color: CyberRoadUi.accentCyan,
    marginBottom: 2,
  },
  labelBest: {
    fontFamily: "retro",
    fontSize: 9,
    letterSpacing: 3,
    color: CyberRoadUi.accentMagenta,
    marginBottom: 2,
  },
  score: {
    color: CyberRoadUi.textPrimary,
    fontFamily: "retro",
    fontSize: 36,
    lineHeight: 40,
    backgroundColor: "transparent",
  },
  highscore: {
    color: CyberRoadUi.accentAmber,
    fontFamily: "retro",
    fontSize: 22,
    letterSpacing: 0.5,
    backgroundColor: "transparent",
  },
});
