// @ts-nocheck
import React from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CYBER_ROAD_GAME_TITLE,
  CYBER_ROAD_STUDIO,
} from "../branding";
import { CYBER_TAGLINE, CyberRoadUi } from "../uiTheme";

let hasShownTitle = false;

function Screen(props) {
  const animation = new Animated.Value(0);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    function onKeyUp({ keyCode }) {
      if ([32, 38].includes(keyCode)) {
        props.onPlay();
      }
    }
    window.addEventListener("keyup", onKeyUp, false);
    return () => {
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  React.useEffect(() => {
    if (!hasShownTitle) {
      hasShownTitle = true;
      Animated.timing(animation, {
        useNativeDriver: process.env.EXPO_OS !== "web",
        toValue: 1,
        duration: 900,
        delay: 0,
        easing: Easing.out(Easing.cubic),
      }).start();
    }
  }, []);

  const { top, bottom, left, right } = useSafeAreaInsets();

  const animatedTitleStyle = {
    opacity: animation,
    transform: [
      {
        scale: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  };

  return (
    <LinearGradient
      colors={["#020008", "#0c0424", "#18082e", "#12041c"]}
      start={{ x: 0.12, y: 0 }}
      end={{ x: 0.88, y: 1 }}
      style={[
        styles.gradientFill,
        {
          paddingTop: top,
          paddingBottom: bottom,
          paddingLeft: left,
          paddingRight: right,
        },
      ]}
    >
      {/* Corner brackets — layout cue distinct from centered “poster” menus */}
      <View
        style={[styles.bracket, styles.bracketTL, { top: top + 18 }]}
        pointerEvents="none"
      />
      <View
        style={[styles.bracket, styles.bracketTR, { top: top + 18 }]}
        pointerEvents="none"
      />
      <View
        style={[styles.bracket, styles.bracketBL, { bottom: bottom + 96 }]}
        pointerEvents="none"
      />
      <View
        style={[styles.bracket, styles.bracketBR, { bottom: bottom + 96 }]}
        pointerEvents="none"
      />

      <TouchableOpacity
        activeOpacity={1}
        style={styles.touchLayer}
        onPressIn={() => {
          Animated.timing(animation, {
            toValue: 0.96,
            duration: 120,
            useNativeDriver: process.env.EXPO_OS !== "web",
          }).start(() => {
            Animated.timing(animation, {
              toValue: 1,
              duration: 180,
              useNativeDriver: process.env.EXPO_OS !== "web",
              easing: Easing.out(Easing.quad),
            }).start();
          });
          props.onPlay();
        }}
      >
        {props.coins ? (
          <Text style={styles.coinsChip}>{props.coins}</Text>
        ) : null}

        <View style={styles.mainColumn}>
          <Animated.View
            style={[styles.titlePanel, animatedTitleStyle]}
            accessibilityRole="header"
            accessibilityLabel={`${CYBER_ROAD_GAME_TITLE}, ${CYBER_ROAD_STUDIO}`}
          >
            <Text style={styles.kicker}>RUNIT ARCADE</Text>
            <Text style={styles.titleWord}>{CYBER_ROAD_GAME_TITLE}</Text>
            <Text style={styles.tagline}>{CYBER_TAGLINE}</Text>
            <View style={styles.divider} />
            <Text style={styles.studio}>{CYBER_ROAD_STUDIO}</Text>
          </Animated.View>

          <View style={styles.ctaPill}>
            <Text style={styles.ctaMain}>TAP ANYWHERE TO START</Text>
            <Text style={styles.ctaSub}>Swipe · move lanes · beat your best</Text>
          </View>
        </View>
      </TouchableOpacity>
    </LinearGradient>
  );
}

export default Screen;

const w = Dimensions.get("window").width;

const styles = StyleSheet.create({
  gradientFill: {
    flex: 1,
  },
  touchLayer: {
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: Platform.OS === "web" ? 24 : 32,
  },
  mainColumn: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Math.min(28, w * 0.06),
  },
  bracket: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: CyberRoadUi.accentMagenta,
    opacity: 0.65,
  },
  bracketTL: {
    left: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  bracketTR: {
    right: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bracketBL: {
    left: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bracketBR: {
    right: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  coinsChip: {
    position: "absolute",
    top: 12,
    right: 16,
    fontFamily: "retro",
    fontSize: 14,
    color: CyberRoadUi.accentAmber,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
    borderRadius: CyberRoadUi.radiusChip,
    backgroundColor: CyberRoadUi.bgPanel,
    borderWidth: 1,
    borderColor: CyberRoadUi.strokeMuted,
    zIndex: 2,
  },
  titlePanel: {
    alignSelf: "flex-start",
    maxWidth: 520,
    width: "100%",
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: CyberRoadUi.radiusPanel,
    backgroundColor: CyberRoadUi.bgPanel,
    borderWidth: 1,
    borderColor: CyberRoadUi.stroke,
    ...Platform.select({
      ios: {
        shadowColor: CyberRoadUi.accentMagenta,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  kicker: {
    fontFamily: "retro",
    fontSize: 11,
    letterSpacing: 6,
    color: CyberRoadUi.accentMagenta,
    marginBottom: 8,
  },
  titleWord: {
    fontFamily: "retro",
    fontSize: 38,
    lineHeight: 44,
    color: CyberRoadUi.textPrimary,
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: "retro",
    fontSize: 13,
    color: CyberRoadUi.accentCyan,
    marginTop: 12,
    letterSpacing: 1,
  },
  divider: {
    marginTop: 20,
    height: 2,
    width: 72,
    backgroundColor: CyberRoadUi.accentMagenta,
    opacity: 0.7,
    borderRadius: 1,
  },
  studio: {
    fontFamily: "retro",
    fontSize: 15,
    color: CyberRoadUi.textMuted,
    marginTop: 14,
    letterSpacing: 3,
  },
  ctaPill: {
    alignSelf: "stretch",
    marginTop: 36,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "rgba(46, 233, 230, 0.08)",
    borderWidth: 1,
    borderColor: CyberRoadUi.stroke,
  },
  ctaMain: {
    fontFamily: "retro",
    fontSize: 15,
    color: CyberRoadUi.textPrimary,
    textAlign: "center",
    letterSpacing: 2,
  },
  ctaSub: {
    fontFamily: "retro",
    fontSize: 11,
    color: CyberRoadUi.textMuted,
    textAlign: "center",
    marginTop: 8,
    letterSpacing: 0.5,
  },
});
