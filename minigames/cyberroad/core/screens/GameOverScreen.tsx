// @ts-nocheck
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Footer from "../components/GameOver/Footer";
import { CYBER_ROAD_GAME_TITLE } from "../branding";
import { CyberRoadUi } from "../uiTheme";

/** Post-run: studio header + bottom dock (no retail-style promo stack). */
function GameOver(props) {
  const { top, bottom, left, right } = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: top || 12, paddingBottom: bottom || 8 },
        props.style,
      ]}
    >
      <View style={[styles.statusBar, { marginHorizontal: left || 4 }]}>
        <Text style={styles.statusKicker}>RUN ENDED</Text>
        <Text style={styles.statusTitle}>{CYBER_ROAD_GAME_TITLE}</Text>
      </View>

      <View style={styles.spacer} />

      <Footer
        style={{ paddingLeft: left || 4, paddingRight: right || 4 }}
        showSettings={props.showSettings}
        setGameState={props.setGameState}
        navigation={props.navigation}
      />
    </View>
  );
}

export default GameOver;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  spacer: {
    flex: 1,
  },
  statusBar: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: CyberRoadUi.radiusChip,
    backgroundColor: "rgba(10, 6, 22, 0.92)",
    borderWidth: 2,
    borderColor: CyberRoadUi.accentMagenta,
    ...Platform.select({
      ios: {
        shadowColor: "#ff2bd6",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      web: { boxShadow: "0 0 16px rgba(255, 43, 214, 0.28)" },
      default: {},
    }),
  },
  statusKicker: {
    fontFamily: "retro",
    fontSize: 10,
    letterSpacing: 4,
    color: CyberRoadUi.accentMagenta,
  },
  statusTitle: {
    fontFamily: "retro",
    fontSize: 14,
    letterSpacing: 2,
    color: CyberRoadUi.textPrimary,
    marginTop: 4,
  },
});
