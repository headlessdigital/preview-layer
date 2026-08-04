<script setup lang="ts">
/**
 * In-CMS live preview harness (shipped by @headless/preview-layer).
 *
 * Renders the draft page with the THEME'S OWN <BlockRenderer> (auto-imported by
 * name — the host app's component wins), then swaps its blocks live as the CMS
 * editor streams them over postMessage. No theme code is touched: this page only
 * re-enters the theme's existing render path.
 *
 * Deliberately theme-agnostic: no imports from a specific theme's `~~/shared/types`.
 */
type PreviewBlock = { id: string; type: string; data?: Record<string, any> }

const route = useRoute()
const config = useRuntimeConfig()

const site = route.query.site as string
const token = route.query.token as string
const slug = ref((route.query.slug as string) || 'home')

// Initial draft (server-side via the layer proxy → no CORS, token stays server-side)
const { data } = await useFetch<{ data?: { content?: { blocks?: PreviewBlock[] } } }>(
  '/__preview/draft',
  { query: { site, slug, token }, watch: [slug] },
)

// Server-enriched snapshot by block id (reviews/form embeds injected by the CMS).
const enrichedById = computed(() => {
  const map: Record<string, PreviewBlock> = {}
  for (const b of (data.value?.data?.content?.blocks ?? [])) map[b.id] = b
  return map
})

// Block types whose final render depends on server-side enrichment. Live edits
// arrive un-enriched from the CMS, so overlay the enriched fields from the last
// server fetch (v1: reviews/forms track the saved draft, not un-saved keystrokes).
const ENRICHED_TYPES = new Set(['google_reviews', 'contact', 'advanced_cta'])

function withEnrichment(blocks: PreviewBlock[]): PreviewBlock[] {
  return blocks.map((b) => {
    if (!ENRICHED_TYPES.has(b.type)) return b
    const server = enrichedById.value[b.id]
    if (!server) return b
    return {
      ...b,
      data: {
        ...b.data,
        reviews: b.data?.reviews?.length ? b.data.reviews : server.data?.reviews,
        _averageRating: b.data?._averageRating ?? server.data?._averageRating,
        _totalCount: b.data?._totalCount ?? server.data?._totalCount,
        formEmbedCode: b.data?.formEmbedCode || server.data?.formEmbedCode,
      },
    }
  })
}

const liveBlocks = ref<PreviewBlock[]>(withEnrichment(data.value?.data?.content?.blocks ?? []))
watch(data, () => { liveBlocks.value = withEnrichment(data.value?.data?.content?.blocks ?? []) })

// Origin allowed to drive the preview. Explicit override, else derive from cmsApiUrl.
const allowedOrigin = computed(() => {
  const pub = config.public as { cmsOrigin?: string; cmsApiUrl?: string }
  if (pub.cmsOrigin) return pub.cmsOrigin
  try { return pub.cmsApiUrl ? new URL(pub.cmsApiUrl).origin : '' } catch { return '' }
})

function onMessage(e: MessageEvent) {
  if (allowedOrigin.value && e.origin !== allowedOrigin.value) return
  const msg = e.data
  if (msg?.type === 'preview-blocks' && Array.isArray(msg.blocks)) {
    if (msg.slug && msg.slug !== slug.value) slug.value = msg.slug
    liveBlocks.value = withEnrichment(msg.blocks as PreviewBlock[])
  }
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  // Signal the CMS parent that we're ready to receive blocks
  window.parent?.postMessage({ type: 'preview-ready' }, allowedOrigin.value || '*')
})
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

// Never index the preview route
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div>
    <BlockRenderer v-for="block in liveBlocks" :key="block.id" :block="block" />
  </div>
</template>
