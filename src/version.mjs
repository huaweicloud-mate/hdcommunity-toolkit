import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let cached;

/**
 * Read the toolkit version from package.json (cached).
 * @returns {string}
 */
export function readPackageVersion() {
  if (cached) return cached;
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    cached = pkg.version || '0.0.0';
  } catch {
    cached = '0.0.0';
  }
  return cached;
}