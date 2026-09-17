// Lets Node run workspace TypeScript whose imports use `.js` specifiers for `.ts` sources.
// Usage: node --experimental-transform-types --no-warnings --import ./scripts/ts-resolve-hook.mjs <script.ts>
import {existsSync} from 'node:fs';
import {register} from 'node:module';
import {fileURLToPath} from 'node:url';
import {isMainThread} from 'node:worker_threads';

export async function resolve(specifier, context, next) {
  if (specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
    const url = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
    if (existsSync(fileURLToPath(url))) return next(url.href, context);
  }
  return next(specifier, context);
}

if (isMainThread) register(import.meta.url);
