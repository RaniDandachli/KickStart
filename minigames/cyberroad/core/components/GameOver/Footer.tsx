// @ts-nocheck
import { isAvailableAsync } from "expo-sharing";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeIonicons } from "@/components/icons/SafeIonicons";

import State from "../../state";
import {
  CYBER_ROAD_GAME_TITLE,
  CYBER_ROAD_SHARE_URL,
  cyberRoadShareBody,
} from "../../branding";
import { CyberRoadUi } from "../../uiTheme";

async function shareAsync() {
  await Share.share(
    {
      message: cyberRoadShareBody(),
      url: CYBER_ROAD_SHARE_URL,
      title: CYBER_ROAD_GAME_TITLE,
    },
    {
      dialogTitle: `Share ${CYBER_ROAD_GAME_TITLE}`,
      excludedActivityTypes: [
        "com.apple.UIKit.activity.AirDrop",
        "com.apple.UIKit.activity.AddToReadingList",
      ],
      tintColor: CyberRoadUi.accentMagenta,
    }
  );
}

function DockButton({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dockBtn, pressed && { opacity: 0.82 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <SafeIonicons name={icon} size={24} color={CyberRoadUi.accentCyan} />
      <Text style={styles.dockLabel}>{label}</Text>
    </Pressable>
  );
}

/** Bottom dock with labeled controls — vector icons + neon frame (not pixel sprite strip). */
export default function Footer({
  style,
  showSettings,
  setGameState,
  navigation,
}) {
  const [canShare, setCanShare] = useState(true);

  useEffect(() => {
    isAvailableAsync()
      .then(setCanShare)
      .catch(() => {});
  }, []);

  return (
    <View style={[styles.shell, style]}>
      <View style={styles.grid}>
        <DockButton
          icon="settings-outline"
          label="OPTIONS"
          onPress={() => {
            alert("Settings coming soon");
          }}
        />
        {canShare ? (
          <DockButton
            icon="share-outline"
            label="SHARE"
            onPress={shareAsync}
          />
        ) : null}
        <DockButton
          icon="trophy-outline"
          label="RANKS"
          onPress={() => {
            alert("Leaderboard coming soon");
          }}
        />
      </View>

      <Pressable
        onPress={() => setGameState(State.Game.none)}
        style={({ pressed }) => [
          styles.primaryStrip,
          pressed && { opacity: 0.9 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Back to Cyber Road menu"
      >
        <SafeIonicons name="grid-outline" size={22} color={CyberRoadUi.bgRoot} />
        <Text style={styles.primaryText}>BACK TO MENU</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderTopLeftRadius: CyberRoadUi.radiusDock,
    borderTopRightRadius: CyberRoadUi.radiusDock,
    backgroundColor: "rgba(6, 5, 18, 0.96)",
    borderTopWidth: 3,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopColor: CyberRoadUi.accentCyan,
    borderLeftColor: "rgba(0, 245, 255, 0.25)",
    borderRightColor: "rgba(0, 245, 255, 0.25)",
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 22 : 16,
    paddingHorizontal: 12,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#00f5ff",
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.28,
        shadowRadius: 18,
      },
      android: { elevation: 14 },
      web: { boxShadow: "0 -8px 28px rgba(0, 245, 255, 0.12)" },
      default: {},
    }),
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-end",
    paddingHorizontal: 4,
    minHeight: 72,
  },
  dockBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 245, 255, 0.35)",
    backgroundColor: "rgba(0, 245, 255, 0.06)",
    maxWidth: 120,
  },
  dockLabel: {
    fontFamily: "retro",
    fontSize: 9,
    letterSpacing: 1,
    color: CyberRoadUi.textMuted,
    marginTop: 6,
    textAlign: "center",
  },
  primaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: CyberRoadUi.accentCyan,
  },
  primaryText: {
    fontFamily: "retro",
    fontSize: 15,
    letterSpacing: 3,
    fontWeight: Platform.OS === "android" ? "bold" : undefined,
    color: CyberRoadUi.bgRoot,
  },
});
