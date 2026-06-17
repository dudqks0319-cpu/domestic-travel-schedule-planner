const { getDefaultConfig } = require("expo/metro-config");
const { resolve } = require("metro-resolver");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.join(workspaceRoot, "node_modules/react")
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return resolve(context, path.join(workspaceRoot, "node_modules", moduleName), platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
