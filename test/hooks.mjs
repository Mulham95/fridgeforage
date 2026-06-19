/**
 * Module-resolution hook for local testing only.
 *
 * The app source uses extensionless relative imports ("./safetyLimits"), which
 * is correct for React Native / Metro but Node's ESM loader rejects. This hook
 * appends ".ts" to extensionless relative specifiers so we can run the REAL
 * source files under `node --test` (Node 24 strips the types itself).
 *
 * This is NOT shipped with the app — it exists purely so the unit tests can
 * exercise the actual modules without a bundler.
 */
export async function resolve(specifier, context, next) {
  if (/^\.\.?\//.test(specifier) && !/\.(ts|js|mjs|cjs|json)$/.test(specifier)) {
    return next(specifier + ".ts", context);
  }
  return next(specifier, context);
}
