/**
 * HTML sanitizer — Req 33.4; Design Data Models (`opportunity_content` stored
 * sanitized) and Frontend §8.
 *
 * `sanitizeHtml` runs opportunity-description HTML through the vetted
 * `sanitize-html` library (pinned exact version) with a strict allowlist. It
 * strips `<script>`/`<style>`/`<iframe>`, all `on*` event-handler attributes,
 * and `javascript:`/`data:` URLs, leaving only markup safe to store and later
 * render. Raw markup is never executed or emitted.
 */

import sanitizeHtmlLib from 'sanitize-html';

/**
 * Allowlist configuration for stored opportunity descriptions. Only formatting
 * and structural tags survive; scripting, embedding, and styling are removed.
 */
const SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    'a',
    'abbr',
    'b',
    'blockquote',
    'br',
    'code',
    'dd',
    'div',
    'dl',
    'dt',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'li',
    'ol',
    'p',
    'pre',
    'section',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    abbr: ['title'],
    // Deliberately no class/style/id anywhere else — no styling vector.
  },
  // Only safe link schemes; `javascript:` and `data:` are excluded.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { a: ['http', 'https', 'mailto'] },
  allowProtocolRelative: false,
  // Drop the *contents* of these tags entirely, not just the tags.
  nonTextTags: ['script', 'style', 'textarea', 'noscript', 'title', 'iframe'],
  // Disallowed tags are removed (default), and any stray attributes not in the
  // allowlist (including all `on*` handlers) are dropped.
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: false,
  transformTags: {
    // Force safe rel/target on surviving anchors (defence-in-depth for render).
    a: sanitizeHtmlLib.simpleTransform('a', {
      rel: 'noopener noreferrer nofollow',
      target: '_blank',
    }),
  },
};

/**
 * Sanitize untrusted HTML for safe storage/rendering of opportunity
 * descriptions. Always returns a string (never throws on malformed markup);
 * an empty/non-string input yields an empty string.
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string' || html.length === 0) {
    return '';
  }
  // Re-add `href` to the allowlist output of the anchor transform.
  return sanitizeHtmlLib(html, {
    ...SANITIZE_OPTIONS,
    allowedAttributes: {
      ...SANITIZE_OPTIONS.allowedAttributes,
      a: ['href', 'title', 'rel', 'target'],
    },
  });
}
