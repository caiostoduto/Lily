import React, { useEffect, useRef, useState } from "react";
import {
  ViroARImageMarker,
  ViroARTrackingTargets,
  ViroMaterials,
  ViroQuad,
} from "@reactvision/react-viro";
import type { ViroAnchor } from "@reactvision/react-viro";
import { type MarkerEntry } from "../../data/markers";
import SafeViroMaterialVideo from "./SafeViroMaterialVideo";
import { createLogger } from "../../logger";

/**
 * Physical width of every printed photo in meters.
 * All prints share the same width; the video height is derived from its ratio.
 */
const PRINT_WIDTH_METERS = 0.1;
const VIDEO_SCALE = 1.0;

/**
 * How long (ms) to keep the video playing after tracking is momentarily lost.
 * AR image tracking can briefly drop during normal camera movement — this
 * grace period prevents distracting pause/resume flicker.
 */
const LOST_TRACKING_GRACE_MS = 150;

type ViroUVCoordinate = [number, number, number, number];

function getCropUvCoordinates(
  sourceRatio: number,
  targetRatio: number
): ViroUVCoordinate {
  if (sourceRatio <= 0 || targetRatio <= 0) {
    return [0, 0, 1, 1];
  }

  if (sourceRatio > targetRatio) {
    const visibleHeight = targetRatio / sourceRatio;
    const top = (1 - visibleHeight) / 2;
    return [0, top, 1, top + visibleHeight];
  }

  const visibleWidth = sourceRatio / targetRatio;
  const left = (1 - visibleWidth) / 2;
  return [left, 0, left + visibleWidth, 1];
}

interface Props {
  marker: MarkerEntry;
  isMuted?: boolean;
  onMarkerUpdate?: (
    id: string,
    isTracked: boolean,
    position?: [number, number, number]
  ) => void;
}

/**
 * Renders a single AR image marker with its companion video overlay.
 *
 * Responsibilities:
 * - Registers the tracking target on mount; cleans up on unmount.
 * - Manages its own `isTracked` state with a debounced grace period.
 * - Sizes the video plane to match the registered print.
 */
function TrackedMarker({ marker, isMuted = false, onMarkerUpdate }: Props) {
  const log = React.useMemo(() => createLogger(`tracked-marker:${marker.id}`), [marker.id]);
  const [isTracked, setIsTracked] = useState(false);
  const [targetReady, setTargetReady] = useState(false);
  const videoMaterialName = `marker-video-${marker.id}`;

  const isTrackedRef = useRef(false);
  const lostTrackingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackingMethodRef = useRef<string | undefined>(undefined);

  // Keep a stable ref for onMarkerUpdate to avoid triggering useEffect
  const onMarkerUpdateRef = useRef(onMarkerUpdate);
  useEffect(() => {
    onMarkerUpdateRef.current = onMarkerUpdate;
  }, [onMarkerUpdate]);

  // Register the tracking target once on mount, clean up on unmount.
  useEffect(() => {
    log.info("Registering image tracking target", {
      cropVideo: marker.cropVideo,
      imageRatio: marker.imageRatio,
      videoRatio: marker.videoRatio,
    });
    ViroARTrackingTargets.createTargets({
      [marker.id]: {
        source: marker.imageSource,
        orientation: "Up",
        physicalWidth: PRINT_WIDTH_METERS,
        type: "Image",
      },
    });

    // Wait until the effect has finished registering the native target before
    // mounting ViroARImageMarker.
    let isMounted = true;
    queueMicrotask(() => {
      if (isMounted) {
        log.debug("Image tracking target is ready");
        setTargetReady(true);
      }
    });

    return () => {
      isMounted = false;
      log.debug("Removing image tracking target");
      ViroARTrackingTargets.deleteTarget(marker.id);
      if (lostTrackingTimerRef.current) {
        clearTimeout(lostTrackingTimerRef.current);
      }
      onMarkerUpdateRef.current?.(marker.id, false);
    };
  }, [log, marker.cropVideo, marker.id, marker.imageRatio, marker.imageSource, marker.videoRatio]);

  useEffect(() => {
    log.debug("Creating video material");
    ViroMaterials.createMaterials({
      [videoMaterialName]: {
        diffuseTexture: { source: marker.videoSource },
        lightingModel: "Constant",
        wrapS: "Clamp",
        wrapT: "Clamp",
      },
    });

    return () => {
      log.debug("Deleting video material");
      ViroMaterials.deleteMaterials([videoMaterialName]);
    };
  }, [log, marker.videoSource, videoMaterialName]);

  const updateAnchorState = (anchorPosition?: [number, number, number]) => {
    if (!isTrackedRef.current) {
      log.info("Image anchor found", { hasPosition: Boolean(anchorPosition) });
      isTrackedRef.current = true;
      setIsTracked(true);
      onMarkerUpdateRef.current?.(marker.id, true, anchorPosition);
    } else if (anchorPosition) {
      onMarkerUpdateRef.current?.(marker.id, true, anchorPosition);
    }

    if (lostTrackingTimerRef.current) {
      clearTimeout(lostTrackingTimerRef.current);
    }

    lostTrackingTimerRef.current = setTimeout(
      handleAnchorRemoved,
      LOST_TRACKING_GRACE_MS
    );
  };

  const handleAnchorFound = (anchor: ViroAnchor) => {
    updateAnchorState(anchor?.position);
  };

  const handleAnchorUpdated = (anchor: ViroAnchor) => {
    // On Android (ARCore), onAnchorRemoved is never fired when the marker
    // leaves the camera view. Instead, onAnchorUpdated keeps firing with
    // trackingMethod === "lastKnownPose". We must treat that as "lost".
    // On iOS, trackingMethod is undefined — treat that as actively tracked.
    const method: string | undefined = anchor?.trackingMethod;
    if (method === "lastKnownPose" || method === "notTracking") {
      if (lastTrackingMethodRef.current !== method) {
        log.debug("Image anchor temporarily lost", { trackingMethod: method });
        lastTrackingMethodRef.current = method;
      }
      // Don't reset the grace timer — let it expire and hide the content.
      return;
    }

    lastTrackingMethodRef.current = method;
    updateAnchorState(anchor?.position);
  };

  const handleAnchorRemoved = () => {
    if (lostTrackingTimerRef.current) {
      clearTimeout(lostTrackingTimerRef.current);
      lostTrackingTimerRef.current = null;
    }
    if (isTrackedRef.current) {
      log.info("Image anchor removed");
    }
    isTrackedRef.current = false;
    setIsTracked(false);
    onMarkerUpdateRef.current?.(marker.id, false);
  };

  // Don't render the marker until the tracking target is registered.
  if (!targetReady) return null;

  const imageRatio = marker.imageRatio > 0 ? marker.imageRatio : 1;
  const videoRatio = marker.videoRatio > 0 ? marker.videoRatio : 1;
  const videoWidth = VIDEO_SCALE * PRINT_WIDTH_METERS;
  const videoHeight =
    videoWidth * (marker.cropVideo ? imageRatio : videoRatio);
  const uvCoordinates = marker.cropVideo
    ? getCropUvCoordinates(videoRatio, imageRatio)
    : ([0, 0, 1, 1] as ViroUVCoordinate);

  return (
    <ViroARImageMarker
      target={marker.id}
      onAnchorFound={handleAnchorFound}
      onAnchorUpdated={handleAnchorUpdated}
      onAnchorRemoved={handleAnchorRemoved}
    >
      <SafeViroMaterialVideo
        material={videoMaterialName}
        loop
        paused={!isTracked}
        muted={isMuted}
      />
      <ViroQuad
        height={videoHeight}
        materials={[videoMaterialName]}
        rotation={[-90, 0, 0]}
        // The native Viro quad expects one flat [u0, v0, u1, v1] tuple. The
        // installed TypeScript wrapper incorrectly declares this as an array
        // of tuples, so keep the runtime value flat and cast only the prop.
        uvCoordinates={uvCoordinates as unknown as ViroUVCoordinate[]}
        visible={isTracked}
        width={videoWidth}
      />
    </ViroARImageMarker>
  );
}

export default React.memo(TrackedMarker);
