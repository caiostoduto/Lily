import { File, Paths } from "expo-file-system";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { addImportedMarkers, type MarkerEntry } from "./markers";

export const LILY_PACKAGE_MIME = "application/vnd.lily.marker-pack+zip";
export const LILY_PACKAGE_EXTENSION = ".lily";

const PACKAGE_FORMAT = "lily-marker-pack";
const PACKAGE_VERSION = 1;
const MAX_PACKAGE_BYTES = 250 * 1024 * 1024;
const MAX_MARKERS_PER_PACKAGE = 100;

interface LilyPackageManifestMarker {
  cropVideo: boolean;
  id: string;
  image: string;
  imageRatio: number;
  video: string;
  videoRatio: number;
}

interface LilyPackageManifest {
  format: typeof PACKAGE_FORMAT;
  markers: LilyPackageManifestMarker[];
  version: typeof PACKAGE_VERSION;
}

export interface LilyPackageImportResult {
  importedCount: number;
}

function packagePathForMarker(index: number, marker: MarkerEntry, extension: string) {
  return `markers/${index + 1}-${marker.id}${extension}`;
}

function isSafePackagePath(path: string) {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").includes("..")
  );
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function parseManifest(value: unknown): LilyPackageManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid Lily package manifest.");
  }

  const candidate = value as Partial<LilyPackageManifest>;
  if (
    candidate.format !== PACKAGE_FORMAT ||
    candidate.version !== PACKAGE_VERSION ||
    !Array.isArray(candidate.markers) ||
    candidate.markers.length === 0 ||
    candidate.markers.length > MAX_MARKERS_PER_PACKAGE
  ) {
    throw new Error("Unsupported Lily package.");
  }

  const markers = candidate.markers.map((marker) => {
    if (
      !marker ||
      typeof marker !== "object" ||
      typeof marker.id !== "string" ||
      !isSafePackagePath(marker.image) ||
      !isSafePackagePath(marker.video) ||
      !isPositiveNumber(marker.imageRatio) ||
      !isPositiveNumber(marker.videoRatio) ||
      typeof marker.cropVideo !== "boolean"
    ) {
      throw new Error("Invalid marker in Lily package.");
    }

    return {
      cropVideo: marker.cropVideo,
      id: marker.id,
      image: marker.image,
      imageRatio: marker.imageRatio,
      video: marker.video,
      videoRatio: marker.videoRatio,
    };
  });

  return {
    format: PACKAGE_FORMAT,
    markers,
    version: PACKAGE_VERSION,
  };
}

export async function createLilyPackage(markers: MarkerEntry[]) {
  if (markers.length === 0) {
    throw new Error("Select at least one marker.");
  }

  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  const manifestMarkers: LilyPackageManifestMarker[] = [];
  let totalMediaBytes = 0;

  for (const [index, marker] of markers.entries()) {
    const imagePath = packagePathForMarker(index, marker, ".jpg");
    const videoPath = packagePathForMarker(index, marker, ".mp4");
    const imageBytes = await new File(marker.imageUri).bytes();
    const videoBytes = await new File(marker.videoUri).bytes();

    totalMediaBytes += imageBytes.byteLength + videoBytes.byteLength;
    if (totalMediaBytes > MAX_PACKAGE_BYTES) {
      throw new Error("These markers are too large to share as one package.");
    }

    files[imagePath] = [imageBytes, { level: 0 }];
    files[videoPath] = [videoBytes, { level: 0 }];
    manifestMarkers.push({
      cropVideo: marker.cropVideo,
      id: marker.id,
      image: imagePath,
      imageRatio: marker.imageRatio,
      video: videoPath,
      videoRatio: marker.videoRatio,
    });
  }

  const manifest: LilyPackageManifest = {
    format: PACKAGE_FORMAT,
    markers: manifestMarkers,
    version: PACKAGE_VERSION,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));

  const packageBytes = zipSync(files);
  const packageFile = new File(
    Paths.cache,
    `lily-markers-${Date.now()}${LILY_PACKAGE_EXTENSION}`
  );
  packageFile.write(packageBytes);
  return packageFile;
}

export async function importLilyPackage(uri: string): Promise<LilyPackageImportResult> {
  const packageFile = new File(uri);
  const packageBytes = await packageFile.bytes();

  if (packageBytes.byteLength > MAX_PACKAGE_BYTES) {
    throw new Error("This Lily package is too large.");
  }

  const files = unzipSync(packageBytes);
  const manifestBytes = files["manifest.json"];
  if (!manifestBytes) {
    throw new Error("This file is not a Lily package.");
  }

  const manifest = parseManifest(JSON.parse(strFromU8(manifestBytes)));
  let totalMediaBytes = manifestBytes.byteLength;
  const imported = [];

  for (const marker of manifest.markers) {
    const imageBytes = files[marker.image];
    const videoBytes = files[marker.video];
    if (!imageBytes || !videoBytes) {
      throw new Error("A marker file is missing from the Lily package.");
    }

    totalMediaBytes += imageBytes.byteLength + videoBytes.byteLength;
    if (totalMediaBytes > MAX_PACKAGE_BYTES) {
      throw new Error("This Lily package is too large.");
    }

    imported.push({
      cropVideo: marker.cropVideo,
      imageBytes,
      imageRatio: marker.imageRatio,
      videoBytes,
      videoRatio: marker.videoRatio,
    });
  }

  const entries = await addImportedMarkers(imported);
  return { importedCount: entries.length };
}
