# eKonobar Mobile

Expo SDK 57 app for iOS and Android. Shares the backend, database and credentials with `apps/web` — see [../../mobile-app-plan.md](../../mobile-app-plan.md).

## Getting it onto a phone

**Expo Go will not work.** `expo-notifications` (and later `@rnmapbox/maps`) carry native code, so you need a **development build** — a real app installed on the device, into which Metro then serves JavaScript.

Everything below has to be run by you: each step needs an interactive login or an account that costs money, so none of it can be scripted ahead of time.

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
