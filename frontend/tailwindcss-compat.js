// This is a compatibility layer for Tailwind CSS
// It exports the @tailwindcss/postcss plugin as if it were the tailwindcss plugin
const tailwindcss = require('@tailwindcss/postcss');
const resolveConfig = require('@tailwindcss/postcss/resolveConfig');
const plugin = tailwindcss;

// Add any missing properties from the original tailwindcss
plugin.resolveConfig = resolveConfig;

module.exports = plugin;
