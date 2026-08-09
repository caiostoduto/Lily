import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppState, Platform } from "react-native";
import "react-native-reanimated";
import { createLogger } from "../logger";

const log = createLogger("app");

export default function RootLayout() {
  useEffect(() => {
    log.info("Root layout mounted", {
      platform: Platform.OS,
      version: Platform.Version,
    });

    const subscription = AppState.addEventListener("change", (nextState) => {
      log.info("App state changed", { state: nextState });
    });

    return () => {
      subscription.remove();
      log.debug("Root layout unmounted");
    };
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar hidden />
    </>
  );
}
