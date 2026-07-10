/**
 * Fixture loader for recorded connector payloads and other on-disk test data.
 *
 * Later tasks (e.g. Greenhouse/Lever/Ashby/JSON-LD contract tests) record real
 * source responses as checked-in fixtures. This utility resolves and reads them
 * relative to a caller-provided base directory, with sync + async and
 * text/JSON/buffer variants.
 */
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

/**
 * A bound fixture loader rooted at a base directory. Fixture names are resolved
 * relative to that directory unless an absolute path is supplied.
 */
export interface FixtureLoader {
  /** Resolve a fixture name to an absolute path. */
  path(name: string): string;
  /** Read a fixture as UTF-8 text (synchronous). */
  readText(name: string): string;
  /** Read a fixture as UTF-8 text (asynchronous). */
  readTextAsync(name: string): Promise<string>;
  /** Read + parse a JSON fixture (synchronous). */
  readJson<T = unknown>(name: string): T;
  /** Read + parse a JSON fixture (asynchronous). */
  readJsonAsync<T = unknown>(name: string): Promise<T>;
  /** Read a fixture as raw bytes (e.g. a recorded HTTP body). */
  readBuffer(name: string): Buffer;
  /** Read a fixture as raw bytes (asynchronous). */
  readBufferAsync(name: string): Promise<Buffer>;
}

/**
 * Create a {@link FixtureLoader} rooted at `baseDir`.
 *
 * @example
 * const fixtures = createFixtureLoader(join(__dirname, 'fixtures'));
 * const payload = fixtures.readJson<GreenhousePayload>('greenhouse/acme.json');
 */
export function createFixtureLoader(baseDir: string): FixtureLoader {
  const resolve = (name: string): string => (isAbsolute(name) ? name : join(baseDir, name));

  return {
    path: resolve,
    readText: (name) => readFileSync(resolve(name), 'utf8'),
    readTextAsync: (name) => readFile(resolve(name), 'utf8'),
    readJson: <T = unknown>(name: string): T =>
      JSON.parse(readFileSync(resolve(name), 'utf8')) as T,
    readJsonAsync: async <T = unknown>(name: string): Promise<T> =>
      JSON.parse(await readFile(resolve(name), 'utf8')) as T,
    readBuffer: (name) => readFileSync(resolve(name)),
    readBufferAsync: (name) => readFile(resolve(name)),
  };
}
