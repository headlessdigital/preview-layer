# @headless/preview-layer

Drop-in Nuxt layer that adds an **in-CMS live-preview route** (`/__preview`) to any Head Less
CMS frontend. It renders the draft page with the theme's **own** `BlockRenderer` and swaps the
blocks live as the CMS editor streams them over `postMessage` — a real, exact-theme "what you're
about to save" preview.

**No theme code required.** The only per-site change is one `extends` line. The layer re-enters
the theme's existing render path (Nuxt component auto-import resolves `BlockRenderer` and the
`Blocks*` block components from the host app, which wins on name collision).

## What it ships

- `app/pages/__preview.vue` — the preview harness page (theme-agnostic; uses the host's `BlockRenderer`).
- `server/routes/__preview/draft.get.ts` — server proxy to the CMS draft endpoint (`${cmsApiUrl}/preview`).
- `nuxt.config.ts` — route rules so `/__preview` is never prerendered/cached and is `noindex`.

Pure config + Vue — no build step, no runtime dependencies.

## Install (per frontend)

**1. Add the layer as a dependency.**

Production (git dependency — public repo, no auth needed in CI):

```bash
yarn add github:headlessdigital/preview-layer
```

Local dev against a sibling checkout instead:

```bash
# ~/sites/<frontend>/nuxt.config.ts
extends: ['../preview-layer']
```

**2. Opt in with one line** in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  extends: ['@headless/preview-layer'],
})
```

**3. Redeploy.** That's the whole change.

### Requirements the host theme already meets

- `runtimeConfig.public.cmsApiUrl` = `${CMS_URL}/api/public` (used by the draft proxy and to
  derive the allowed CMS origin).
- A `BlockRenderer` component taking a singular `block` prop (standard in this pattern).
- A `default` layout (standard) so the preview renders real header/footer chrome.

### Config

- `CMS_ORIGIN` (optional) — the CMS editor's origin, allowed to `postMessage` into the preview.
  If unset, it's derived from `cmsApiUrl`'s origin. Set it explicitly only when the CMS app origin
  differs from the API origin (e.g. local dev where the CMS runs on a different port).

The preview secret lives **only in the CMS** (it signs/verifies tokens there). This layer never
sees it — it only passes a token through.

## How it works

1. CMS editor mints a short-lived, site-scoped token (`GET /api/preview-token`) and loads
   `${frontend}/__preview?site=&slug=&token=` in an iframe.
2. This layer's `/__preview` page fetches the draft server-side via `/__preview/draft` →
   `${cmsApiUrl}/preview` (token verified there; unpublished content returned).
3. On mount the page posts `{type:'preview-ready'}` to `window.parent`; the CMS replies with
   `{type:'preview-blocks', blocks}` on every (debounced) edit. Origins are verified both ways.

### Enrichment note

`google_reviews` / `contact` / `advanced_cta` blocks depend on server-side enrichment (reviews,
form embeds). Live-streamed edits arrive un-enriched, so the page overlays those fields from the
last server draft fetch — reviews/forms track the saved draft rather than un-saved keystrokes.
