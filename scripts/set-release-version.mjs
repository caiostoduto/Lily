import { readFileSync, writeFileSync } from "node:fs";

const [version, buildNumber, mode] = process.argv.slice(2);

if (!version || !buildNumber) {
  throw new Error("Usage: node set-release-version.mjs <version> <build-number> [--check-only]");
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid version: ${version}`);
}

if (!/^\d+$/.test(buildNumber) || Number(buildNumber) < 1) {
  throw new Error(`Invalid build number: ${buildNumber}`);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const appJson = JSON.parse(readFileSync("app.json", "utf8"));
const altSource = JSON.parse(readFileSync("altsource.json", "utf8"));

if (mode === "--check-only") {
  process.stdout.write(`Version ${version} and build ${buildNumber} are valid.\n`);
  process.exit(0);
}

packageJson.version = version;
appJson.expo.version = version;
appJson.expo.ios = {
  ...appJson.expo.ios,
  buildNumber: String(buildNumber),
};
appJson.expo.android = {
  ...appJson.expo.android,
  versionCode: Number(buildNumber),
};

const altStoreApp = altSource.apps?.[0];
if (!altStoreApp) {
  throw new Error("altsource.json does not contain an app entry.");
}

const versions = Array.isArray(altStoreApp.versions) ? altStoreApp.versions : [];
const previousVersion = versions[0] ?? {};
const nextVersion = {
  ...previousVersion,
  version,
  buildVersion: String(buildNumber),
  date: new Date().toISOString(),
  downloadURL:
    previousVersion.downloadURL ??
    "https://github.com/caiostoduto/lily/releases/latest/download/Lily-release.ipa",
};

// Keep older entries, but make the new release the current first entry. This
// also initializes an empty AltSource versions array on the first release.
altStoreApp.versions = [nextVersion, ...versions.slice(1)];

writeFileSync("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
writeFileSync("app.json", `${JSON.stringify(appJson, null, 2)}\n`);
writeFileSync("altsource.json", `${JSON.stringify(altSource, null, 2)}\n`);
