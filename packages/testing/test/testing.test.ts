import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import net from 'node:net';
import { describe, it, expect } from 'vitest';
import {
  fc,
  fcConfig,
  MIN_PROPERTY_RUNS,
  propertyTest,
  createFixtureLoader,
  arbUrl,
  arbHttpsUrl,
  arbDomain,
  arbIpAddress,
  arbPublicIpv4,
} from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = createFixtureLoader(join(here, 'fixtures'));

describe('property config', () => {
  it('defaults to the project minimum of 100 runs', () => {
    expect(fcConfig.numRuns).toBe(100);
    expect(MIN_PROPERTY_RUNS).toBe(100);
  });
});

describe('fixture loader', () => {
  it('resolves fixture paths relative to the base dir', () => {
    expect(fixtures.path('example.json')).toBe(join(here, 'fixtures', 'example.json'));
  });

  it('reads and parses JSON fixtures', () => {
    const payload = fixtures.readJson<{ source: string; company: string }>('example.json');
    expect(payload.source).toBe('greenhouse');
    expect(payload.company).toBe('Acme');
  });

  it('reads JSON fixtures asynchronously', async () => {
    const payload = await fixtures.readJsonAsync<{ title: string }>('example.json');
    expect(payload.title).toBe('Senior Software Engineer');
  });

  it('reads raw bytes', () => {
    expect(fixtures.readBuffer('example.json').byteLength).toBeGreaterThan(0);
  });
});

describe('network arbitraries', () => {
  it('arbUrl produces parseable http(s) URLs', () => {
    fc.assert(
      fc.property(arbUrl(), (u) => {
        const parsed = new URL(u);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      }),
      fcConfig,
    );
  });

  it('arbHttpsUrl always yields https', () => {
    fc.assert(
      fc.property(arbHttpsUrl(), (u) => new URL(u).protocol === 'https:'),
      fcConfig,
    );
  });

  it('arbDomain produces non-empty dotted domains', () => {
    fc.assert(
      fc.property(arbDomain(), (d) => d.length > 0 && d.includes('.')),
      fcConfig,
    );
  });

  it('arbIpAddress produces valid IPv4/IPv6 blocked addresses', () => {
    fc.assert(
      fc.property(arbIpAddress(), (ip) => net.isIP(ip) !== 0),
      fcConfig,
    );
  });

  it('arbPublicIpv4 produces valid IPv4 addresses outside private/loopback/link-local', () => {
    fc.assert(
      fc.property(arbPublicIpv4(), (ip) => {
        if (net.isIPv4(ip) === false) return false;
        const parts = ip.split('.').map(Number) as [number, number, number, number];
        const [a, b] = parts;
        const isPrivate = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
        const isLoopback = a === 127;
        const isLinkLocal = a === 169 && b === 254;
        return !isPrivate && !isLoopback && !isLinkLocal;
      }),
      fcConfig,
    );
  });
});

// Exercise the propertyTest helper itself (registers a Vitest test with the
// 100-run baseline applied).
propertyTest(
  'propertyTest applies the shared fast-check baseline',
  fc.property(fc.integer(), (n) => Number.isInteger(n)),
);
