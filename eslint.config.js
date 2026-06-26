// Raycast's shared flat ESLint config (ESLint 9+ format).
// defineConfig normalizes the nested config arrays the Raycast preset ships.
const { defineConfig } = require("eslint/config");
const raycastConfig = require("@raycast/eslint-config");

module.exports = defineConfig(raycastConfig);
