import { ViroMaterialVideo } from "@reactvision/react-viro";
import { findNodeHandle, NativeModules, Platform } from "react-native";

interface AndroidUIManager {
  VRTMaterialVideo?: {
    Commands?: {
      pause?: number;
    };
  };
  dispatchViewManagerCommand?: (
    nodeHandle: number,
    command: number,
    args: number[]
  ) => void;
}

/**
 * Viro's Android ViroMaterialVideo cleanup assumes the legacy UIManager is
 * always present. With Fabric it can be null, so cleanup must be best-effort.
 */
export default class SafeViroMaterialVideo extends ViroMaterialVideo {
  componentWillUnmount() {
    const nodeHandle = findNodeHandle(this);
    if (!nodeHandle) {
      return;
    }

    if (Platform.OS === "android") {
      const uiManager = NativeModules.UIManager as AndroidUIManager | null;
      const pauseCommand = uiManager?.VRTMaterialVideo?.Commands?.pause;

      if (uiManager?.dispatchViewManagerCommand && pauseCommand !== undefined) {
        uiManager.dispatchViewManagerCommand(nodeHandle, pauseCommand, [0]);
      }
    } else if (Platform.OS === "ios") {
      NativeModules.VRTMaterialVideoManager?.pause?.(nodeHandle);
    }
  }
}
