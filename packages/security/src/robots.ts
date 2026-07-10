/**
 * Minimal robots.txt handling — Req 31.2; Design Security §2 ("respect robots
 * directives where applicable, cached per host").
 *
 * This is a pragmatic subset of the robots exclusion protocol: it groups rules
 * by user-agent, supports `Allow`/`Disallow` with `*` wildcards and `$` anchors,
 * and applies longest-match precedence (Allow wins ties). Full robots meta / RFC
 * 9309 edge cases are intentionally out of scope for this slice.
 */

/** A single path rule extracted from a robots group. */
interface RobotRule {
  allow: boolean;
  /** Compiled matcher for the rule path. */
  test: (path: string) => boolean;
  /** Specificity used for longest-match precedence (pattern length). */
  length: number;
}

/** Parsed rule set for a specific user-agent (already group-resolved). */
export interface RobotRules {
  rules: RobotRule[];
}

/** Contract for deciding whether a URL may be fetched under robots rules. */
export interface RobotsChecker {
  isAllowed(url: string, userAgent: string): Promise<boolean>;
}

/** Robots checker that permits everything (used when robots are not enforced). */
export class AllowAllRobotsChecker implements RobotsChecker {
  isAllowed(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

function compileRulePath(pattern: string): (path: string) => boolean {
  // Translate the robots glob (`*` = any run, `$` = end anchor) into a RegExp.
  let hasEndAnchor = false;
  let body = pattern;
  if (body.endsWith('$')) {
    hasEndAnchor = true;
    body = body.slice(0, -1);
  }
  const escaped = body
    .split('*')
    .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  const regex = new RegExp(`^${escaped}${hasEndAnchor ? '$' : ''}`);
  return (path: string) => regex.test(path);
}

/**
 * Parse a robots.txt document into the rule set applying to `userAgent`.
 * Rules from a matching specific group are preferred; otherwise the `*` group
 * is used. An empty rule set means "allow all".
 */
export function parseRobots(text: string, userAgent: string): RobotRules {
  const uaToken = userAgent.toLowerCase();
  const groups = new Map<string, RobotRule[]>();

  let currentAgents: string[] = [];
  let sawDirectiveSinceAgent = false;

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (line.length === 0) {
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) {
      continue;
    }
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      // Consecutive user-agent lines share the following rules.
      if (sawDirectiveSinceAgent) {
        currentAgents = [];
        sawDirectiveSinceAgent = false;
      }
      currentAgents.push(value.toLowerCase());
      if (!groups.has(value.toLowerCase())) {
        groups.set(value.toLowerCase(), []);
      }
      continue;
    }

    if (field === 'allow' || field === 'disallow') {
      sawDirectiveSinceAgent = true;
      if (currentAgents.length === 0) {
        continue;
      }
      // A `Disallow:` with an empty value means "allow all" for the group.
      if (value.length === 0) {
        continue;
      }
      const rule: RobotRule = {
        allow: field === 'allow',
        test: compileRulePath(value),
        length: value.length,
      };
      for (const agent of currentAgents) {
        groups.get(agent)!.push(rule);
      }
    }
  }

  // Choose the most specific matching agent group, else `*`.
  let chosen: RobotRule[] | undefined;
  let bestLen = -1;
  for (const [agent, rules] of groups.entries()) {
    if (agent === '*') {
      continue;
    }
    if (uaToken.includes(agent) && agent.length > bestLen) {
      chosen = rules;
      bestLen = agent.length;
    }
  }
  if (!chosen) {
    chosen = groups.get('*') ?? [];
  }
  return { rules: chosen };
}

/** Apply parsed rules to a path; longest-match wins, Allow breaks ties. */
export function isPathAllowed(rules: RobotRules, path: string): boolean {
  let decision = true;
  let bestLength = -1;
  let bestAllow = true;
  for (const rule of rules.rules) {
    if (rule.test(path) && rule.length >= bestLength) {
      if (rule.length > bestLength || rule.allow) {
        bestLength = rule.length;
        bestAllow = rule.allow;
      }
    }
  }
  if (bestLength >= 0) {
    decision = bestAllow;
  }
  return decision;
}

/** Fetches a `text` body for a URL (injected so robots use the SafeFetcher path). */
export type RobotsTextFetcher = (robotsUrl: string) => Promise<string | null>;

/**
 * Robots checker that fetches and caches `robots.txt` per host. A missing or
 * unreadable robots file is treated as "allow all" (standard behaviour).
 */
export class CachedRobotsChecker implements RobotsChecker {
  private readonly cache = new Map<string, string | null>();

  constructor(private readonly fetchText: RobotsTextFetcher) {}

  async isAllowed(url: string, userAgent: string): Promise<boolean> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return true;
    }
    const host = parsed.host;
    let text = this.cache.get(host);
    if (text === undefined) {
      const robotsUrl = `${parsed.protocol}//${host}/robots.txt`;
      try {
        text = await this.fetchText(robotsUrl);
      } catch {
        text = null;
      }
      this.cache.set(host, text);
    }
    if (!text) {
      return true;
    }
    const rules = parseRobots(text, userAgent);
    return isPathAllowed(rules, `${parsed.pathname}${parsed.search}`);
  }
}
