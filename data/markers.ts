import { useEffect, useState, useSyncExternalStore } from "react";
import { Directory, File, Paths } from "expo-file-system";
import { createLogger } from "../logger";

const log = createLogger("markers");

export interface MarkerRecord {
  id: string;
  imageUri: string;
  imageRatio: number;
  videoUri: string;
  videoRatio: number;
  cropVideo: boolean;
}

export interface MarkerEntry extends MarkerRecord {
  imageSource: { uri: string };
  videoSource: { uri: string };
}

const markerDirectory = new Directory(Paths.document, "markers");
const markerIndexFile = new File(Paths.document, "markers.json");

let records: MarkerRecord[] = [];
let entries: MarkerEntry[] = [];
let hasLoaded = false;
let loadingPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function toEntry(record: MarkerRecord): MarkerEntry {
  return {
    ...record,
    imageSource: { uri: record.imageUri },
    videoSource: { uri: record.videoUri },
  };
}

function publish(nextRecords: MarkerRecord[]) {
  records = nextRecords;
  entries = records.map(toEntry);
  log.debug("Published marker state", { count: records.length });
  for (const listener of listeners) {
    listener();
  }
}

function parseMarkerRecord(value: unknown): MarkerRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<MarkerRecord>;
  if (
    typeof candidate.id === "string" &&
    typeof candidate.imageUri === "string" &&
    typeof candidate.videoUri === "string" &&
    typeof candidate.videoRatio === "number" &&
    Number.isFinite(candidate.videoRatio) &&
    candidate.videoRatio > 0
  ) {
    return {
      cropVideo: candidate.cropVideo === false ? false : true,
      id: candidate.id,
      imageRatio:
        typeof candidate.imageRatio === "number" && candidate.imageRatio > 0
          ? candidate.imageRatio
          : 1,
      imageUri: candidate.imageUri,
      videoRatio: candidate.videoRatio,
      videoUri: candidate.videoUri,
    };
  }

  return null;
}

async function persist() {
  log.debug("Persisting marker index", { count: records.length });
  if (!markerIndexFile.exists) {
    markerIndexFile.create({ intermediates: true });
  }
  markerIndexFile.write(JSON.stringify(records));
}

export async function loadMarkers() {
  if (hasLoaded) {
    log.debug("Marker index already loaded", { count: records.length });
    return;
  }

  if (!loadingPromise) {
    const startedAt = Date.now();
    log.info("Loading marker index", { exists: markerIndexFile.exists });
    loadingPromise = (async () => {
      try {
        if (markerIndexFile.exists) {
          const parsed: unknown = JSON.parse(await markerIndexFile.text());
          if (Array.isArray(parsed)) {
            const validRecords = parsed
              .map(parseMarkerRecord)
              .filter((record): record is MarkerRecord => record !== null);
            publish(validRecords);
            log.info("Loaded marker index", {
              count: validRecords.length,
              discardedCount: parsed.length - validRecords.length,
              durationMs: Date.now() - startedAt,
            });
          }
        }
      } catch (error) {
        log.error("Failed to load marker index; using an empty list", error, {
          durationMs: Date.now() - startedAt,
        });
        publish([]);
      } finally {
        hasLoaded = true;
        loadingPromise = null;
        for (const listener of listeners) {
          listener();
        }
      }
    })();
  }

  await loadingPromise;
}

export async function addMarker(input: {
  cropVideo: boolean;
  imageRatio: number;
  imageUri: string;
  videoUri: string;
  videoRatio: number;
}) {
  const startedAt = Date.now();
  log.info("Adding marker", {
    cropVideo: input.cropVideo,
    imageRatio: input.imageRatio,
    videoRatio: input.videoRatio,
  });
  await loadMarkers();
  markerDirectory.create({ idempotent: true, intermediates: true });

  const id = `marker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const imageFile = new File(markerDirectory, `${id}.jpg`);
  const videoFile = new File(markerDirectory, `${id}.mp4`);

  try {
    await new File(input.imageUri).copy(imageFile, { overwrite: true });
    await new File(input.videoUri).copy(videoFile, { overwrite: true });

    const record: MarkerRecord = {
      cropVideo: input.cropVideo,
      id,
      imageRatio: input.imageRatio,
      imageUri: imageFile.uri,
      videoUri: videoFile.uri,
      videoRatio: input.videoRatio,
    };

    const nextRecords = [...records, record];
    await persistRecords(nextRecords);
    publish(nextRecords);
    log.info("Marker added", {
      count: nextRecords.length,
      durationMs: Date.now() - startedAt,
      markerId: id,
    });
    return toEntry(record);
  } catch (error) {
    if (imageFile.exists) {
      imageFile.delete();
    }
    if (videoFile.exists) {
      videoFile.delete();
    }
    log.error("Failed to add marker; copied files were cleaned up", error, {
      durationMs: Date.now() - startedAt,
      markerId: id,
    });
    throw error;
  }
}

export async function addImportedMarkers(
  inputs: Array<{
    cropVideo: boolean;
    imageBytes: Uint8Array;
    imageRatio: number;
    videoBytes: Uint8Array;
    videoRatio: number;
  }>
) {
  const startedAt = Date.now();
  log.info("Adding imported markers", { count: inputs.length });
  await loadMarkers();
  markerDirectory.create({ idempotent: true, intermediates: true });

  const createdFiles: File[] = [];
  const importedRecords: MarkerRecord[] = [];

  try {
    for (const input of inputs) {
      const id = `marker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const imageFile = new File(markerDirectory, `${id}.jpg`);
      const videoFile = new File(markerDirectory, `${id}.mp4`);

      imageFile.write(input.imageBytes);
      videoFile.write(input.videoBytes);
      createdFiles.push(imageFile, videoFile);

      importedRecords.push({
        cropVideo: input.cropVideo,
        id,
        imageRatio: input.imageRatio,
        imageUri: imageFile.uri,
        videoRatio: input.videoRatio,
        videoUri: videoFile.uri,
      });
    }

    const nextRecords = [...records, ...importedRecords];
    await persistRecords(nextRecords);
    publish(nextRecords);
    log.info("Imported markers added", {
      count: importedRecords.length,
      durationMs: Date.now() - startedAt,
      totalCount: nextRecords.length,
    });
    return importedRecords.map(toEntry);
  } catch (error) {
    for (const file of createdFiles) {
      if (file.exists) {
        file.delete();
      }
    }
    log.error("Failed to add imported markers; copied files were cleaned up", error, {
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

export async function deleteMarker(id: string) {
  const startedAt = Date.now();
  log.info("Deleting marker", { markerId: id });
  await loadMarkers();

  const record = records.find((marker) => marker.id === id);
  if (!record) {
    log.warn("Delete requested for an unknown marker", { markerId: id });
    return;
  }

  const nextRecords = records.filter((marker) => marker.id !== id);
  await persistRecords(nextRecords);
  publish(nextRecords);

  // Metadata is removed first so a failed file cleanup cannot leave a broken
  // marker registered on the next app launch. These files are app-owned.
  for (const uri of [record.imageUri, record.videoUri]) {
    try {
      const file = new File(uri);
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      // The marker is already removed from the index; an orphaned file is safe
      // to ignore and can be cleaned up during a future storage pass.
      log.warn("Could not remove a marker media file", {
        error: error instanceof Error ? error.message : String(error),
        markerId: id,
      });
    }
  }
  log.info("Marker deleted", {
    count: records.length,
    durationMs: Date.now() - startedAt,
    markerId: id,
  });
}

async function persistRecords(nextRecords: MarkerRecord[]) {
  const previousRecords = records;
  records = nextRecords;
  try {
    await persist();
  } catch (error) {
    records = previousRecords;
    throw error;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return entries;
}

export function useMarkers() {
  const markerEntries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [isLoaded, setIsLoaded] = useState(hasLoaded);

  useEffect(() => {
    void loadMarkers().then(() => setIsLoaded(true));
  }, []);

  return { entries: markerEntries, isLoaded };
}
