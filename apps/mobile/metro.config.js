// Metro, made workspace-aware.
//
// Three settings, each fixing a specific way Metro breaks inside an npm-workspaces
// monorepo. Without them the bundler either cannot find @ekonobar/shared or loads
// two copies of React.
const { getDefaultConfig } = require("expo/metro-config");
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

// 3. Do NOT walk up the directory tree looking for modules. Left on, Metro can
//    resolve react from apps/web's tree as well as its own and end up bundling
//    two Reacts — which surfaces as "Invalid hook call", far from its cause.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
