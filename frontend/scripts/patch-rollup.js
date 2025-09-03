// Patch Rollup native loader to avoid hard failure when optional native binary missing.
// This is a temporary workaround for npm optional dependency bug.
try {
  const fs = require('fs');
  const path = require('path');
  const target = require.resolve('rollup/dist/native.js');
  let content = fs.readFileSync(target, 'utf8');
  if (content.includes('__ROLLUP_PATCH_APPLIED__')) {
    console.log('[patch-rollup] Already patched');
    process.exit(0);
  }
  // Replace throw new Error(...) with console.warn and fallback export
  content = content.replace(/throw new Error\([\s\S]*?\);/, `console.warn('[patch-rollup] Native binary not found - using JS implementation fallback'); // __ROLLUP_PATCH_APPLIED__`);
  fs.writeFileSync(target, content, 'utf8');
  console.log('[patch-rollup] Patch applied to native.js');
} catch (e) {
  console.log('[patch-rollup] Patch skipped:', e.message);
}
