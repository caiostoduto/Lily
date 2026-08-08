import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MarkerCreationMode from "../components/marker/MarkerCreationMode";
import MarkerManager from "../components/marker/MarkerManager";
import ARSceneView from "../components/viro/ARSceneView";
import { useMarkers } from "../data/markers";

export default function Home() {
  const [isCreating, setIsCreating] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [isArReady, setIsArReady] = useState(false);
  const insets = useSafeAreaInsets();
  const { entries: markers, isLoaded: markersLoaded } = useMarkers();
  const [iconProgress] = useState(() => new Animated.Value(0));

  const handleOpenCreation = useCallback(() => {
    setIsArReady(false);
    setIsManaging(false);
    setIsCreating(true);
  }, []);

  const handleCloseCreation = useCallback(() => {
    setIsArReady(false);
    setIsCreating(false);
  }, []);

  const handleOpenManager = useCallback(() => {
    setIsArReady(false);
    setIsManaging(true);
  }, []);

  const handleCloseManager = useCallback(() => {
    setIsArReady(false);
    setIsManaging(false);
  }, []);

  const handleArReady = useCallback(() => {
    setIsArReady(true);
  }, []);

  useEffect(() => {
    Animated.timing(iconProgress, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      toValue: isCreating ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [iconProgress, isCreating]);

  useEffect(() => {
    if (isCreating || isManaging || !markersLoaded) {
      return;
    }

    const fallback = setTimeout(() => setIsArReady(true), 3000);
    return () => clearTimeout(fallback);
  }, [isCreating, isManaging, markersLoaded]);

  const iconRotation = iconProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  return (
    <View style={styles.container}>
      {isCreating ? (
        <MarkerCreationMode onClose={handleCloseCreation} />
      ) : isManaging ? (
        <MarkerManager onClose={handleCloseManager} />
      ) : !markersLoaded ? (
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Loading markers…</Text>
        </View>
      ) : (
        <View style={styles.arStage}>
          <ARSceneView
            markersCount={markers.length}
            onReady={handleArReady}
            style={styles.arNavigator}
          />
          {!isArReady ? (
            <View pointerEvents="none" style={styles.arCover}>
              <ActivityIndicator color="#F081B4" size="small" />
            </View>
          ) : null}
        </View>
      )}

      {!isCreating && !isManaging && markersLoaded && markers.length === 0 ? (
        <View pointerEvents="none" style={styles.emptyHint}>
          <Text style={styles.emptyHintText}>Tap + to add your first marker</Text>
        </View>
      ) : null}

      {markersLoaded && !isManaging ? (
        !isCreating ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage registered markers"
            onPress={handleOpenManager}
            style={({ pressed }) => [
              styles.manageButton,
              { bottom: insets.bottom + 18 },
              pressed && styles.addButtonPressed,
            ]}
          >
            <Text style={styles.manageButtonText}>≡</Text>
          </Pressable>
        ) : null
      ) : null}

      {markersLoaded && !isManaging ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isCreating ? "Close marker creation mode" : "Add a marker"}
          onPress={isCreating ? handleCloseCreation : handleOpenCreation}
          style={({ pressed }) => [
            styles.addButton,
            isCreating && styles.addButtonActive,
            { bottom: insets.bottom + 18 },
            pressed && styles.addButtonPressed,
          ]}
        >
          <Animated.Text
            style={[
              styles.addButtonText,
              isCreating && styles.addButtonTextActive,
              { transform: [{ rotate: iconRotation }] },
            ]}
          >
            +
          </Animated.Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  arNavigator: { flex: 1 },
  arStage: { flex: 1 },
  arCover: {
    alignItems: "center",
    backgroundColor: "#111118",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  loadingState: {
    alignItems: "center",
    backgroundColor: "#111118",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: "#B8B8C2",
    fontSize: 15,
  },
  emptyHint: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: "46%",
  },
  emptyHintText: {
    backgroundColor: "rgba(17, 17, 24, 0.78)",
    borderRadius: 18,
    color: "#FFFFFF",
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: "#F4A7C6",
    borderColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
    borderRadius: 30,
    elevation: 5,
    height: 56,
    justifyContent: "center",
    position: "absolute",
    right: 24,
    shadowColor: "#26141D",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    width: 56,
  },
  manageButton: {
    alignItems: "center",
    backgroundColor: "rgba(17, 17, 24, 0.9)",
    borderColor: "rgba(255, 255, 255, 0.28)",
    borderRadius: 30,
    borderWidth: 1,
    elevation: 5,
    height: 56,
    justifyContent: "center",
    left: 24,
    position: "absolute",
    shadowColor: "#26141D",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    width: 56,
  },
  manageButtonText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "300",
    lineHeight: 34,
  },
  addButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },
  addButtonActive: {
    backgroundColor: "#29242C",
    borderColor: "#5A4D59",
  },
  addButtonText: {
    color: "#321522",
    fontSize: 32,
    fontWeight: "300",
    lineHeight: 36,
  },
  addButtonTextActive: {
    color: "#FFFFFF",
  },
});
