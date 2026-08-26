// Metro, made workspace-aware.
//
// Three settings, each fixing a specific way Metro breaks inside an npm-workspaces
// monorepo. Without them the bundler either cannot find @ekonobar/shared or loads
// two copies of React.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot   = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole workspace. @ekonobar/shared is consumed as TypeScript source
//    with no build step, so Metro has to see files outside apps/mobile — and has
//    to notice when they change, or an edit in packages/shared needs a restart.
config.watchFolders = [workspaceRoot];

// 2. Resolve from the root node_modules too. npm hoists most dependencies there,
//    so the app-local folder alone is not enough.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Hierarchical lookup is deliberately LEFT ON.
//
// The obvious monorepo advice is to disable it so Metro cannot resolve a second
// copy of react from a sibling workspace. That breaks more than it fixes here:
// npm nests a package's own dependencies when versions conflict — e.g.
// react-native-reanimated needs semver@^7 while semver@6 is hoisted, so npm puts
// 7 in react-native-reanimated/node_modules — and disabling hierarchical lookup
// stops Metro looking there at all. The bundle then dies on
// "Unable to resolve module semver/functions/satisfies".
//
// The duplicate-react problem it guards against does not exist in this repo:
// react and react-native are hoisted to the root and there is exactly one copy
// of each. If a second ever appears, fix the duplication rather than hiding it
// from the resolver.

// NativeWind v4 needs its own Metro wrapper: it compiles global.css through
// Tailwind and installs the transform that turns className into styles. Without
// it the bundle still builds — which is why `expo export` passed — but the CSS
// import reaches the runtime unprocessed and the app dies on launch.
module.exports = withNativeWind(config, { input: "./global.css" });
