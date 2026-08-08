import * as ImagePicker from "expo-image-picker";
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
} from "react-native-document-scanner-plugin";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addMarker } from "../../data/markers";

interface Props {
  onClose: () => void;
}

/**
 * Marker creation starts a native document-scanner flow instead of mounting
 * Viro. This keeps the AR session and scanner from competing for the camera.
 */
export default function MarkerCreationMode({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [imageRatio, setImageRatio] = useState(1);
  const [cropVideo, setCropVideo] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scanPhoto = useCallback(async () => {
    setIsScanning(true);
    setErrorMessage(null);
    setSelectedVideo(null);
    setImageRatio(1);

    try {
      const result = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
        maxNumDocuments: 1,
        responseType: ResponseType.ImageFilePath,
      });
      const imagePath = result.scannedImages?.[0];

      if (result.status === ScanDocumentResponseStatus.Success && imagePath) {
        setScannedImage(imagePath);
        Image.getSize(
          imagePath,
          (width, height) => {
            if (width > 0 && height > 0) {
              setImageRatio(height / width);
            }
          },
          () => setImageRatio(1)
        );
      }
    } catch {
      setErrorMessage("Could not scan that photo.");
    } finally {
      setIsScanning(false);
    }
  }, []);

  const pickVideo = useCallback(async () => {
    setErrorMessage(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: false,
        mediaTypes: ["videos"],
        videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedVideo(result.assets[0]);
      }
    } catch {
      setErrorMessage("Could not choose that video.");
    }
  }, []);

  const saveMarker = useCallback(async () => {
    if (!scannedImage || !selectedVideo) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await addMarker({
        cropVideo,
        imageRatio,
        imageUri: scannedImage,
        videoRatio:
          selectedVideo.width > 0
            ? selectedVideo.height / selectedVideo.width
            : 1,
        videoUri: selectedVideo.uri,
      });
      onClose();
    } catch {
      setErrorMessage("Could not save this marker.");
    } finally {
      setIsSaving(false);
    }
  }, [cropVideo, imageRatio, onClose, scannedImage, selectedVideo]);

  const hasScannedPhoto = scannedImage !== null;
  const videoName = selectedVideo?.fileName || "Video not chosen";

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 12 },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Add marker</Text>
          <View style={styles.stepPill}>
            <Text style={styles.stepText}>{hasScannedPhoto ? "2 of 2" : "1 of 2"}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {hasScannedPhoto
            ? "Choose a video for this photo."
            : "Fit one printed photo inside the frame."}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 96 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isScanning && !hasScannedPhoto ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color="#F081B4" size="large" />
            <Text style={styles.helperText}>Finding photo…</Text>
          </View>
        ) : hasScannedPhoto ? (
          <View style={styles.markerForm}>
            <Image source={{ uri: scannedImage }} style={styles.preview} />

            <View style={styles.videoCard}>
              <View style={styles.videoCopy}>
                <Text style={styles.videoLabel}>Video</Text>
                <Text numberOfLines={1} style={styles.videoName}>
                  {videoName}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedVideo ? "Change video" : "Choose video"}
                onPress={() => void pickVideo()}
                style={({ pressed }) => [
                  styles.outlineButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.outlineButtonText}>
                  {selectedVideo ? "Change" : "Choose"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.optionCard}>
              <View style={styles.videoCopy}>
                <Text style={styles.optionTitle}>Fit video to photo</Text>
                <Text style={styles.optionDescription}>Crop the edges to match</Text>
              </View>
              <Switch
                accessibilityLabel="Fit video to photo"
                onValueChange={setCropVideo}
                thumbColor="#FFFFFF"
                trackColor={{ false: "#4D4652", true: "#D96F9C" }}
                value={cropVideo}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add marker"
              disabled={!selectedVideo || isSaving}
              onPress={() => void saveMarker()}
              style={({ pressed }) => [
                styles.primaryButton,
                (!selectedVideo || isSaving) && styles.disabledButton,
                pressed && selectedVideo && styles.buttonPressed,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#321522" />
              ) : (
                <Text style={styles.primaryButtonText}>Add marker</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scan another photo"
              disabled={isSaving}
              onPress={() => void scanPhoto()}
              style={({ pressed }) => [
                styles.textButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.textButtonText}>Scan another</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.helperText}>
              Place one printed photo in view. The scanner finds its edges.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scan photo"
              onPress={() => void scanPhoto()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Scan photo</Text>
            </Pressable>
          </View>
        )}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111118",
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    gap: 8,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#B8B8C2",
    fontSize: 16,
    lineHeight: 22,
  },
  stepPill: {
    backgroundColor: "#29242C",
    borderColor: "#48404B",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stepText: {
    color: "#D8D0D9",
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: 28,
  },
  emptyState: {
    alignItems: "center",
    gap: 20,
    maxWidth: 300,
  },
  helperText: {
    color: "#D5D5DE",
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  markerForm: {
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  preview: {
    backgroundColor: "#24212A",
    borderRadius: 16,
    height: 240,
    width: "100%",
  },
  videoCard: {
    alignItems: "center",
    backgroundColor: "#24212A",
    borderColor: "#39333E",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    width: "100%",
  },
  optionCard: {
    alignItems: "center",
    backgroundColor: "#24212A",
    borderColor: "#39333E",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    width: "100%",
  },
  optionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
  },
  optionDescription: {
    color: "#9D96A4",
    fontSize: 12,
  },
  videoCopy: {
    flex: 1,
    gap: 4,
    marginRight: 12,
  },
  videoLabel: {
    color: "#B8B8C2",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  videoName: {
    color: "#FFFFFF",
    fontSize: 15,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#F4A7C6",
    borderColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 24,
    width: "100%",
  },
  primaryButtonText: {
    color: "#321522",
    fontSize: 16,
    fontWeight: "700",
  },
  outlineButton: {
    borderColor: "#F081B4",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  outlineButtonText: {
    color: "#F5A9CC",
    fontSize: 14,
    fontWeight: "600",
  },
  textButton: {
    padding: 8,
  },
  textButtonText: {
    color: "#F5A9CC",
    fontSize: 15,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.42,
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  errorText: {
    color: "#FF9B9B",
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
  },
});
