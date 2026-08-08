import { useCallback, useRef, useState } from "react";
import { ViroARScene, type ViroCameraTransform } from "@reactvision/react-viro";
import { useMarkers } from "../../data/markers";
import TrackedMarker from "./TrackedMarker";

interface Props {
  onReady?: () => void;
}

interface TrackedMarkerState {
  isTracked: boolean;
  position: [number, number, number];
}

const UPDATE_THROTTLE_MS = 40; // Throttle center marker calculation to 24Hz

/**
 * Root AR scene that renders one `TrackedMarker` per registered image/video pair.
 * Markers stay mounted even in editing mode so that native tracking targets
 * are never deleted — ViroAR doesn't reliably re-register them after deletion.
 *
 * Audio is un-muted only for the marker closest to the center of the screen/camera view.
 */
export default function OpeningScene({ onReady }: Props = {}) {
  const { entries: markers } = useMarkers();
  const [activeSoundMarkerId, setActiveSoundMarkerId] = useState<string | null>(null);

  const activeSoundMarkerIdRef = useRef<string | null>(null);
  const markerStates = useRef<Map<string, TrackedMarkerState>>(new Map());
  const cameraTransformRef = useRef<ViroCameraTransform | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const hasReportedReadyRef = useRef(false);

  const handleTrackingUpdated = useCallback(() => {
    if (hasReportedReadyRef.current) {
      return;
    }
    hasReportedReadyRef.current = true;
    onReady?.();
  }, [onReady]);

  const updateActiveMarker = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastUpdateTimeRef.current < UPDATE_THROTTLE_MS) {
      return;
    }
    lastUpdateTimeRef.current = now;

    const camera = cameraTransformRef.current;
    let bestMarkerId: string | null = null;
    let bestDot = -Infinity;

    // Collect all currently tracked markers
    const activeEntries: { id: string; pos: [number, number, number] }[] = [];
    markerStates.current.forEach((state, id) => {
      if (state.isTracked) {
        activeEntries.push({ id, pos: state.position });
      }
    });

    if (activeEntries.length === 0) {
      if (activeSoundMarkerIdRef.current !== null) {
        activeSoundMarkerIdRef.current = null;
        setActiveSoundMarkerId(null);
      }
      return;
    }

    if (activeEntries.length === 1 || !camera) {
      const singleId = activeEntries[0].id;
      if (activeSoundMarkerIdRef.current !== singleId) {
        activeSoundMarkerIdRef.current = singleId;
        setActiveSoundMarkerId(singleId);
      }
      return;
    }

    const camPos = camera.position;
    const forward = camera.forward;

    for (const entry of activeEntries) {
      const vx = entry.pos[0] - camPos[0];
      const vy = entry.pos[1] - camPos[1];
      const vz = entry.pos[2] - camPos[2];
      const dist = Math.hypot(vx, vy, vz);

      if (dist < 0.001) continue;

      // Normalized dot product with camera forward vector (cos theta)
      const dot = (vx * forward[0] + vy * forward[1] + vz * forward[2]) / dist;

      if (dot > bestDot) {
        bestDot = dot;
        bestMarkerId = entry.id;
      }
    }

    if (bestMarkerId) {
      const currentActive = activeSoundMarkerIdRef.current;
      let nextActive = bestMarkerId;

      if (currentActive && currentActive !== bestMarkerId) {
        const currentMarkerState = markerStates.current.get(currentActive);
        if (currentMarkerState?.isTracked) {
          const cvx = currentMarkerState.position[0] - camPos[0];
          const cvy = currentMarkerState.position[1] - camPos[1];
          const cvz = currentMarkerState.position[2] - camPos[2];
          const cdist = Math.hypot(cvx, cvy, cvz);
          if (cdist >= 0.001) {
            const currentDot = (cvx * forward[0] + cvy * forward[1] + cvz * forward[2]) / cdist;
            // Only switch if new marker is noticeably closer to center (+0.03 dot threshold)
            if (bestDot < currentDot + 0.03) {
              nextActive = currentActive;
            }
          }
        }
      }

      if (activeSoundMarkerIdRef.current !== nextActive) {
        activeSoundMarkerIdRef.current = nextActive;
        setActiveSoundMarkerId(nextActive);
      }
    }
  }, []);

  const handleMarkerUpdate = useCallback(
    (id: string, isTracked: boolean, position?: [number, number, number]) => {
      const existing = markerStates.current.get(id);
      const wasTracked = existing?.isTracked ?? false;
      const pos = position || existing?.position || [0, 0, 0];
      markerStates.current.set(id, { isTracked, position: pos });
      
      // Only force an immediate recalculation if tracking status actually changed
      const trackingStatusChanged = wasTracked !== isTracked;
      updateActiveMarker(trackingStatusChanged);
    },
    [updateActiveMarker]
  );

  const handleCameraTransformUpdate = useCallback(
    (cameraTransform: ViroCameraTransform) => {
      cameraTransformRef.current = cameraTransform;
      updateActiveMarker(false);
    },
    [updateActiveMarker]
  );

  return (
    <ViroARScene
      onCameraTransformUpdate={handleCameraTransformUpdate}
      onTrackingUpdated={handleTrackingUpdated}
    >
      {markers.map((marker) => (
        <TrackedMarker
          key={marker.id}
          marker={marker}
          isMuted={activeSoundMarkerId !== null && activeSoundMarkerId !== marker.id}
          onMarkerUpdate={handleMarkerUpdate}
        />
      ))}
    </ViroARScene>
  );
}
