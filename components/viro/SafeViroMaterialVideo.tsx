import { ViroMaterialVideo } from "@reactvision/react-viro";
import { findNodeHandle, NativeModules, Platform } from "react-native";
import { createLogger } from "../../logger";

const log = createLogger("video-cleanup");

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
      log.debug("Skipping video cleanup because the native node is unavailable");
      return;
    }

    if (Platform.OS === "android") {
      const uiManager = NativeModules.UIManager as AndroidUIManager | null;
      const pauseCommand = uiManager?.VRTMaterialVideo?.Commands?.pause;

      if (uiManager?.dispatchViewManagerCommand && pauseCommand !== undefined) {
        uiManager.dispatchViewManagerCommand(nodeHandle, pauseCommand, [0]);
        log.debug("Paused Android video during cleanup");
      } else {
        log.warn("Android video cleanup command is unavailable");
      }
    } else if (Platform.OS === "ios") {
      NativeModules.VRTMaterialVideoManager?.pause?.(nodeHandle);
      log.debug("Paused iOS video during cleanup");
    }
  }
}
