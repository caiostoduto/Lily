import { useEffect, useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  ViroARSceneNavigator,
} from "@reactvision/react-viro";
import OpeningScene from "./OpeningScene";
import { createLogger } from "../../logger";

const log = createLogger("ar-navigator");

interface Props {
  markersCount: number;
  onReady: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function ARSceneView({ markersCount, onReady, style }: Props) {
  useEffect(() => {
    log.info("Mounting native AR navigator", { markersCount });
    return () => log.debug("Unmounting native AR navigator");
  }, [markersCount]);

  const initialScene = useMemo(
    () => ({
      passProps: { onReady },
      scene: OpeningScene,
    }),
    [onReady]
  );

  return (
    <ViroARSceneNavigator
      autofocus
      initialScene={initialScene}
      numberOfTrackedImages={markersCount}
      provider="none"
      style={style}
    />
  );
}
