const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Monorepo paths
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro resolve packages in both mobile node_modules and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
