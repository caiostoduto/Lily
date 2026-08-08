import { useEffect, useState, useSyncExternalStore } from "react";
import { Directory, File, Paths } from "expo-file-system";

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
  if (!markerIndexFile.exists) {
    markerIndexFile.create({ intermediates: true });
  }
  markerIndexFile.write(JSON.stringify(records));
}

export async function loadMarkers() {
  if (hasLoaded) {
    return;
  }

  if (!loadingPromise) {
    loadingPromise = (async () => {
      try {
        if (markerIndexFile.exists) {
          const parsed: unknown = JSON.parse(await markerIndexFile.text());
          if (Array.isArray(parsed)) {
            publish(
              parsed
                .map(parseMarkerRecord)
                .filter((record): record is MarkerRecord => record !== null)
            );
          }
        }
      } catch {
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
    return toEntry(record);
  } catch (error) {
    if (imageFile.exists) {
      imageFile.delete();
    }
    if (videoFile.exists) {
      videoFile.delete();
    }
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
    return importedRecords.map(toEntry);
  } catch (error) {
    for (const file of createdFiles) {
      if (file.exists) {
        file.delete();
      }
    }
    throw error;
  }
}

export async function deleteMarker(id: string) {
  await loadMarkers();

  const record = records.find((marker) => marker.id === id);
  if (!record) {
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
    } catch {
      // The marker is already removed from the index; an orphaned file is safe
      // to ignore and can be cleaned up during a future storage pass.
    }
  }
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
