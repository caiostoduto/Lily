import { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  ViroARSceneNavigator,
} from "@reactvision/react-viro";
import OpeningScene from "./OpeningScene";

interface Props {
  markersCount: number;
  onReady: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function ARSceneView({ markersCount, onReady, style }: Props) {
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
