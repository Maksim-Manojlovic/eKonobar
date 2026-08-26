# eKonobar Mobile

Expo SDK 57 app for iOS and Android. Shares the backend, database and credentials with `apps/web` — see [../../mobile-app-plan.md](../../mobile-app-plan.md).

## Starting Metro — run it from the right directory

```bash
npm start --workspace @ekonobar/mobile     # from anywhere in the repo
# or
cd apps/mobile && npx expo start
```

**`npx expo start` from the repo root looks like it works and does not.** Expo treats
whatever directory it is started in as the project, and the root `package.json` has no
`main`, so it falls back to the legacy `expo/AppEntry` entry point and tries to resolve
an `App.js` that this project does not have. Metro starts, the QR appears, and the phone
gets a 500 on the bundle. Use the workspace script and the question does not arise.

Two symptoms of having done it: the dev server binds **8082** instead of 8081 (because
something already holds 8081), and the manifest's `launchAsset` points at
`node_modules/expo/AppEntry.bundle` rather than `node_modules/expo-router/entry.bundle`.
To check:

```bash
curl -s -H "expo-platform: ios" http://localhost:8081/ | grep -o "launchAsset[^,]*"
```

## Getting it onto a phone

There are two ways to run this on a device, and which one you need depends on what
you are testing.

**Expo Go works today** — see the Expo Go section below. Every native module the app
currently imports ships inside Expo Go, so it is the fastest way to look at screens.

**A development build is required** as soon as the app uses native code Expo Go does
not carry: push notifications (`expo-notifications` — remote push was dropped from
Expo Go in SDK 53) and the map (`@rnmapbox/maps`, phase 8). That is a real app
installed on the device, into which Metro then serves JavaScript.

The development-build steps below have to be run by you: each needs an interactive
login or an account that costs money, so none of it can be scripted ahead of time.

### 0. Accounts (start now — this is the long pole)

| Account | Cost | Needed for |
|---|---|---|
| Expo | free | EAS Build, EAS Update, push credentials |
| Apple Developer Program | 99 USD/yr | **any** iOS device build, including TestFlight |
| Google Play Console | 25 USD once | Play internal testing |

The Apple enrollment is the item that gates the schedule. For a company account it needs a D-U-N-S number and entity verification, which has historically taken one to four weeks. Nothing else in the plan waits on it, so start it before you need it.

`eas.json` and `app.json` are ready except for the project id — `eas init` fills that in.

### 1. One-time setup

```bash
npm i -g eas-cli
eas login
cd apps/mobile
eas init            # replaces the PLACEHOLDER-PROJECT-ID in app.json
```

### 2. Android, today

Android needs no paid account to install a build on your own device:

```bash
eas build --profile development --platform android
```

Install the APK, then `npm start --workspace @ekonobar/mobile` and scan the QR.

### Expo Go (iOS) — for screens that use no custom native code

Expo Go can run this today: the app imports nine native modules and all of them ship
inside Expo Go. It will stop being enough the moment push notifications are wired up —
Expo Go dropped remote push support in SDK 53.

**Expo Go supports exactly one SDK, and the App Store build lags npm.** This project is
pinned to whatever `expoGoSdkVersion` reports, currently **SDK 54** — not `expo@latest`,
which is several SDKs ahead and produces "incompatible versions" on the device with no
update available to fix it. Before bumping the SDK, check what Expo Go actually runs:

```bash
curl -s https://api.expo.dev/v2/versions/latest | grep -o "\"expoGoSdkVersion\":\"[^\"]*\""
```

**iOS Expo Go has no manual URL entry and no QR scanner.** Scan the QR from the terminal
with the system **Camera app**; it deep-links into Expo Go. If you need a QR without a
terminal, `npx qrcode -o qr.png "exp://<lan-ip>:8081"`.

**If `expo start` dies with `TypeError: fetch failed`**, it is the dependency-version
check calling Expo's API, not your code. Start with `EXPO_OFFLINE=1` to skip it
(`--offline` cannot be combined with `--lan`).

Expo Go's "Development servers" list relies on local-network discovery that Windows
Firewall usually blocks, so the server often never appears there. Do not wait for it:

- scan the QR with the **iPhone Camera app** (not Expo Go's scanner), or
- Expo Go, then "Enter URL manually", then `exp://<your-lan-ip>:8081`

The phone must be on the same Wi-Fi, and iOS will ask once for **Local Network**
permission — allow it.

### 3. iOS, once Apple enrollment completes

```bash
eas build --profile development --platform ios
```

**You are on Windows, so this cannot be built locally** — there is no way around that, and it is why every iOS build goes through EAS's cloud macOS builders.

### 4. Push credentials

Expo's push service fronts APNs and FCM, so the credentials are uploaded once to the Expo project rather than living in this repo:

```bash
eas credentials          # iOS: push key (.p8).  Android: FCM v1 service account JSON.
```

Until that is done `POST /api/mobile/push/register` still stores tokens and the server still tries to send — the sends just fail, and the retry cron gives up after three attempts.

## Build profiles

| Profile | What it is | API it points at |
|---|---|---|
| `development` | dev client, Metro attaches | `http://10.0.2.2:3000` — the Android emulator's alias for the host machine's localhost. On a physical device change this to your machine's LAN IP. |
| `preview` | standalone internal build, no Metro | production |
| `production` | store build, auto-incrementing build number | production |

## Notes that will save you an afternoon

- **Never hand-pick dependency versions.** `npx expo install <pkg>`, and `npm run align` after an SDK bump. The SDK moves fast enough that a guessed version yields an unbuildable tree.
- **`expo export --platform android`** is the cheapest full check that the workspace still bundles. Worth running after any change to `packages/shared`, which Metro consumes as TypeScript source with no build step.
- **`metro.config.js` has three workspace settings and all three matter.** `disableHierarchicalLookup` is the subtle one: without it Metro can resolve `react` from `apps/web`'s tree as well as its own and bundle two copies, which surfaces as *"Invalid hook call"* nowhere near its cause.
- **The design prototype in `design/` is stale in three specific ways** — the BRONZE/PLATINUM tier ladder, the PRO/PRO+ subscription, and the role switcher. All three were resolved in favour of the codebase; read `mobile-app-plan.md` §15 before porting a screen that shows any of them.
