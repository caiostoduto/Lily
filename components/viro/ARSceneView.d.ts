import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";

interface ARSceneViewProps {
  markersCount: number;
  onReady: () => void;
  style?: StyleProp<ViewStyle>;
}

declare const ARSceneView: ComponentType<ARSceneViewProps>;

export default ARSceneView;
