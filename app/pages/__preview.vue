<script setup lang="ts">
/**
 * In-CMS live preview harness (shipped by @headless/preview-layer).
 *
 * Renders the draft page with the THEME'S OWN <BlockRenderer> (auto-imported by
 * name — the host app's component wins), then swaps its blocks live as the CMS
 * editor streams them over postMessage. No theme code is touched.
 *
 * Portable across the two BlockRenderer contracts in this portfolio:
 *   - array:  <BlockRenderer :blocks="all" />   (renders + groups the whole list)
 *   - single: <BlockRenderer :block="one" />    (looped per block)
 * The contract is detected from the resolved component's declared props.
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
// arrive un-enriched, so overlay the enriched fields from the last server fetch.
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

// Origin allowed to drive the preview. Explicit override (CMS_ORIGIN), else derive
// from whichever CMS URL the theme exposes publicly (cmsApiUrl or cmsUrl).
const allowedOrigin = computed(() => {
  const pub = config.public as { cmsOrigin?: string; cmsApiUrl?: string; cmsUrl?: string }
  if (pub.cmsOrigin) return pub.cmsOrigin
  const apiish = pub.cmsApiUrl || pub.cmsUrl
  try { return apiish ? new URL(apiish).origin : '' } catch { return '' }
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
  window.parent?.postMessage({ type: 'preview-ready' }, allowedOrigin.value || '*')
})
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

// ── Renderer contract detection ────────────────────────────────────────────
// Resolve the theme's own BlockRenderer and inspect its declared props so we
// pass the shape it expects: `:blocks` (array) or `:block` (single, looped).
const Renderer = resolveComponent('BlockRenderer')
const rendererResolved = computed(() => typeof Renderer !== 'string')
const rendererMode = computed<'array' | 'single'>(() => {
  const comp = Renderer as any
  const p = comp && typeof comp === 'object' ? comp.props : null
  const names: string[] = !p ? [] : Array.isArray(p) ? p : Object.keys(p)
  if (names.includes('block') && !names.includes('blocks')) return 'single'
  return 'array' // default: whole-list renderer (also covers unknown)
})
</script>

<template>
  <div>
    <template v-if="rendererResolved">
      <component :is="Renderer" v-if="rendererMode === 'array'" :blocks="liveBlocks" />
      <template v-else>
        <component :is="Renderer" v-for="b in liveBlocks" :key="b.id" :block="b" />
      </template>
    </template>
    <div v-else style="padding:2rem;font-family:system-ui,sans-serif;color:#64748b">
      Live preview: this frontend has no auto-imported <code>&lt;BlockRenderer&gt;</code> component.
    </div>
  </div>
</template>
