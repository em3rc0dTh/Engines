import { fromExistingAdapter } from '../canonical/compatibility.js';
import type { CanonicalCTAEvent } from '../canonical/types.js';
import { FacebookCommentAdapter } from './facebook-comment.adapter.js';
import { decodeFacebookComments } from './meta.webhook.js';

type Headers = Readonly<Record<string, string | string[] | undefined>>;

export type MetaPageRoutes = Readonly<Record<string, string>>;

export function parseMetaPageRoutes(raw: string | undefined): MetaPageRoutes {
  if (!raw?.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('META_PAGE_ROUTES_INVALID');
  }

  const routes: Record<string, string> = {};
  for (const [pageId, businessSlug] of Object.entries(parsed as Record<string, unknown>)) {
    if (!pageId.trim() || typeof businessSlug !== 'string' || !businessSlug.trim()) {
      throw new Error('META_PAGE_ROUTES_INVALID');
    }
    routes[pageId.trim()] = businessSlug.trim();
  }
  return routes;
}

/**
 * Provider authentication and payload decoding happen before business intent
 * normalization. The Cloudflare edge may verify the same signature first, but
 * Engines deliberately verifies the original raw Meta body again.
 */
export function canonicalizeFacebookPageComments(input: Readonly<{
  rawBody: string;
  headers: Headers;
  appSecret: string;
  routes: MetaPageRoutes;
  receivedAt: string;
}>): CanonicalCTAEvent[] {
  const adapter = new FacebookCommentAdapter();
  const comments = decodeFacebookComments(input.rawBody, input.headers, input.appSecret);
  const output: CanonicalCTAEvent[] = [];

  for (const comment of comments) {
    const businessSlug = input.routes[comment.pageId];
    if (!businessSlug) throw new Error(`META_PAGE_ROUTE_NOT_CONFIGURED:${comment.pageId}`);

    const event = fromExistingAdapter(
      adapter,
      comment,
      { businessSlug },
      input.receivedAt,
    );
    if (event) output.push(event);
  }

  return output;
}
