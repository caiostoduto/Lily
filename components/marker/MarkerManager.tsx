import { useCallback, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createLilyPackage,
  importLilyPackage,
} from "../../data/lilyPackage";
import { deleteMarker, type MarkerEntry, useMarkers } from "../../data/markers";

interface Props {
  onClose: () => void;
}

export default function MarkerManager({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { entries: markers, isLoaded } = useMarkers();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [activeAction, setActiveAction] = useState<"import" | "share" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedMarkers = markers.filter((marker) => selectedIds.has(marker.id));

  const confirmDelete = useCallback((marker: MarkerEntry) => {
    Alert.alert(
      "Delete marker?",
      "This removes the saved photo and video from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setDeletingId(marker.id);
            void deleteMarker(marker.id)
              .catch(() => {
                Alert.alert("Could not delete marker", "Please try again.");
              })
              .finally(() => setDeletingId(null));
          },
        },
      ]
    );
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelecting = useCallback(() => {
    setIsSelecting((current) => !current);
    setSelectedIds(new Set());
    setStatusMessage(null);
  }, []);

  const handleShare = useCallback(async () => {
    if (selectedMarkers.length === 0) {
      return;
    }

    setActiveAction("share");
    setStatusMessage(null);

    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device.");
      }

      const packageFile = await createLilyPackage(selectedMarkers);
      await Sharing.shareAsync(packageFile.uri, {
        dialogTitle: "Share Lily markers",
        mimeType: "application/zip",
        UTI: "public.zip-archive",
      });
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not share these markers."
      );
    } finally {
      setActiveAction(null);
    }
  }, [selectedMarkers]);

  const handleImport = useCallback(async () => {
    setActiveAction("import");
    setStatusMessage(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: "*/*",
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const { importedCount } = await importLilyPackage(result.assets[0].uri);
      setIsSelecting(false);
      setSelectedIds(new Set());
      setStatusMessage(
        `Imported ${importedCount} ${importedCount === 1 ? "marker" : "markers"}.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not import this file."
      );
    } finally {
      setActiveAction(null);
    }
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Markers</Text>
          <Text style={styles.subtitle}>
            {markers.length} {markers.length === 1 ? "registered marker" : "registered markers"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close marker manager"
          onPress={onClose}
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import Lily markers"
          disabled={activeAction !== null}
          onPress={() => void handleImport()}
          style={({ pressed }) => [
            styles.actionButton,
            activeAction !== null && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {activeAction === "import" ? (
            <ActivityIndicator color="#F5A9CC" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>Import</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSelecting ? "Cancel marker selection" : "Select markers to share"}
          disabled={activeAction !== null || markers.length === 0}
          onPress={toggleSelecting}
          style={({ pressed }) => [
            styles.actionButton,
            (activeAction !== null || markers.length === 0) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.actionButtonText}>{isSelecting ? "Cancel" : "Select"}</Text>
        </Pressable>
        {isSelecting ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Share ${selectedMarkers.length} selected markers`}
            disabled={activeAction !== null || selectedMarkers.length === 0}
            onPress={() => void handleShare()}
            style={({ pressed }) => [
              styles.shareButton,
              (activeAction !== null || selectedMarkers.length === 0) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {activeAction === "share" ? (
              <ActivityIndicator color="#321522" size="small" />
            ) : (
              <Text style={styles.shareButtonText}>
                Share{selectedMarkers.length ? ` (${selectedMarkers.length})` : ""}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
      {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!isLoaded ? (
          <ActivityIndicator color="#F081B4" size="large" />
        ) : markers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No markers yet</Text>
            <Text style={styles.emptyText}>
              Add a marker to see it here.
            </Text>
          </View>
        ) : (
          markers.map((marker, index) => (
            <View
              key={marker.id}
              style={[
                styles.markerCard,
                isSelecting && selectedIds.has(marker.id) && styles.markerCardSelected,
              ]}
            >
              {isSelecting ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selectedIds.has(marker.id) }}
                  accessibilityLabel={`Select marker ${index + 1}`}
                  onPress={() => toggleSelection(marker.id)}
                  style={({ pressed }) => [styles.selectionButton, pressed && styles.pressed]}
                >
                  <View
                    style={[
                      styles.selectionCircle,
                      selectedIds.has(marker.id) && styles.selectionCircleSelected,
                    ]}
                  >
                    {selectedIds.has(marker.id) ? (
                      <Text style={styles.selectionCheck}>✓</Text>
                    ) : null}
                  </View>
                </Pressable>
              ) : null}
              <Image source={marker.imageSource} style={styles.thumbnail} />
              <View style={styles.markerCopy}>
                <Text style={styles.markerTitle}>Marker {index + 1}</Text>
                <Text numberOfLines={1} style={styles.markerSubtitle}>
                  Photo and video saved
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete marker ${index + 1}`}
                disabled={deletingId !== null}
                onPress={() => confirmDelete(marker)}
                style={({ pressed }) => [
                  styles.deleteButton,
                  deletingId !== null && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                {deletingId === marker.id ? (
                  <ActivityIndicator color="#FFB1B1" size="small" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete</Text>
                )}
              </Pressable>
            </View>
          ))
        )}
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
    color: "#9D96A4",
    fontSize: 14,
    marginTop: 4,
  },
  doneButton: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  doneButtonText: {
    color: "#F5A9CC",
    fontSize: 16,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 20,
  },
  actionButton: {
    alignItems: "center",
    borderColor: "#5A4D59",
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 14,
  },
  actionButtonText: {
    color: "#F5A9CC",
    fontSize: 14,
    fontWeight: "600",
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: "#F4A7C6",
    borderRadius: 18,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  shareButtonText: {
    color: "#321522",
    fontSize: 14,
    fontWeight: "700",
  },
  statusMessage: {
    color: "#B8B8C2",
    fontSize: 13,
    paddingTop: 10,
  },
  content: {
    flexGrow: 1,
    gap: 12,
    justifyContent: "flex-start",
    paddingTop: 28,
  },
  markerCard: {
    alignItems: "center",
    backgroundColor: "#24212A",
    borderColor: "#39333E",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 10,
  },
  markerCardSelected: {
    borderColor: "#D96F9C",
  },
  selectionButton: {
    padding: 4,
  },
  selectionCircle: {
    alignItems: "center",
    borderColor: "#756A78",
    borderRadius: 12,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  selectionCircleSelected: {
    backgroundColor: "#D96F9C",
    borderColor: "#D96F9C",
  },
  selectionCheck: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  thumbnail: {
    backgroundColor: "#3A2935",
    borderRadius: 10,
    height: 68,
    width: 68,
  },
  markerCopy: {
    flex: 1,
    gap: 4,
  },
  markerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  markerSubtitle: {
    color: "#9D96A4",
    fontSize: 13,
  },
  deleteButton: {
    borderColor: "#75414B",
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 62,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: "#FFB1B1",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  emptyText: {
    color: "#B8B8C2",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
});
