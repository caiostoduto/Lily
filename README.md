<div align="center">
  <img src="./assets/images/icon-rounded.png" alt="Lily" width="180" />

  <h1>Lily</h1>

  <p>Bring printed photos to life with augmented reality.</p>
</div>

Lily turns a printed photo into an AR video marker. Point the camera at a registered photo and its video plays on top of it.

## Features

- Scan a printed photo and choose a video for it.
- Track multiple photos with AR.
- Fit or crop videos to the photo.
- Manage and delete markers stored on the device.
- Share and import markers as `.lily` files.

## Installation

### iOS

Choose one of the options below on your iPhone or iPad:

<table>
  <tr>
    <td>
    Stable
    </td>
    <td>
      <a href="https://altdirect.app/?url=https://raw.githubusercontent.com/caiostoduto/lily/main/altsource.json" target="_blank">
        <img src="https://raw.githubusercontent.com/StikStore/altdirect/refs/heads/main/assets/png/AltSource_Blue.png" alt="Add Lily AltSource" width="200" />
      </a>
    </td>
    <td>
      <a href="https://github.com/caiostoduto/lily/releases/latest/download/Lily-release.ipa" target="_blank">
        <img src="https://raw.githubusercontent.com/StikStore/altdirect/refs/heads/main/assets/png/Download_Blue.png" alt="Download Lily IPA" width="200" />
      </a>
    </td>
  </tr>
</table>

The AltSource can be opened with a compatible sideloader such as AltStore, SideStore, or StikStore. The downloaded IPA can also be imported directly into a sideloader.

You can also find the IPA and source files on the [latest GitHub Release](https://github.com/caiostoduto/lily/releases/latest).

The IPA is unsigned and must be signed by the sideloader during installation. A free Apple ID normally requires periodic refreshing; this is an Apple signing limitation, not a Lily limitation.

### Android

1. Download the APK from the [latest GitHub Release](https://github.com/caiostoduto/lily/releases/latest).
2. Install it on an [ARCore-compatible Android device](https://developers.google.com/ar/devices).
3. If Android asks, allow installation from the source used to download the APK.

Lily needs camera access and a device with AR support. It is not supported in Expo Go or in a web browser.

## Requirements for development

### Common

- Node.js 24 or newer.
- pnpm 11.

### iOS

- macOS.
- Xcode 16.1 or newer.
- CocoaPods.
- An iPhone or iPad with ARKit support for camera testing. The iOS Simulator can build the app, but it cannot replace a physical AR test device.

### Android

- Android Studio.
- Android SDK and emulator/device tools.
- JDK 17.
- A physical ARCore-compatible Android device for camera testing.

## Development

Lily uses Expo prebuild and a native development build. The generated `ios/` and `android/` directories are ignored by Git.

```sh
pnpm install
pnpm exec expo prebuild
pnpm exec expo run:ios       # or: pnpm exec expo run:android
pnpm exec expo start --dev-client
```

Run `expo prebuild` again after changing native configuration.

Useful checks:

```sh
pnpm exec tsc --noEmit
pnpm lint
```

## Project layout

- `app/` — Expo Router entry points.
- `components/marker/` — marker scanning, creation, and management UI.
- `components/viro/` — AR scene and tracked video components.
- `data/markers.ts` — local marker storage.
- `data/lilyPackage.ts` — `.lily` export and import format.
- `altsource.json` — AltStore source metadata.
- `scripts/set-release-version.mjs` — release version and build-number update.

Markers are created from the app with the `+` button and copied into its local storage.

## CI and releases

GitHub Actions has two workflows:

- `CI` runs on commits and pull requests. It type-checks, lints, and builds Debug APK and IPA artifacts.
- `Release builds` is started manually from the GitHub Actions tab. Enter a version, release title, and release notes. It runs checks, builds Release APK and IPA artifacts, updates the app version and build number, commits the changes, and creates the GitHub Release.

The IPA artifacts are unsigned and intended to be installed through AltStore, which signs them during installation. Direct iPhone installation requires Apple signing credentials and provisioning profiles.

## License

Lily is free software licensed under the [GNU General Public License v3.0](LICENSE).

The Lily icon is based on artwork by [Muhammad Ali](https://www.flaticon.com/free-icons/water-lily) from Flaticon.
