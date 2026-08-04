/**
 * GET /__preview/draft?site=&slug=&token=
 *
 * Layer-owned server proxy: forwards to the CMS draft/preview endpoint
 * (`${base}/preview`) server-side so the browser never makes a cross-origin
 * request and the preview token stays server-to-server on the initial load.
 *
 * The CMS base is resolved from whichever runtime-config key the host theme uses:
 *   - public.cmsApiUrl   (markings-style, already ends in /api/public)
 *   - cmsUrl             (pwa-style, private server-side base URL → + /api/public)
 *   - public.cmsUrl      (fallback if a theme exposes it publicly)
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const pub = config.public as { cmsApiUrl?: string; cmsUrl?: string }
  const privUrl = (config as { cmsUrl?: string }).cmsUrl // server-side private config

  const base =
    pub.cmsApiUrl
    || (privUrl ? `${privUrl.replace(/\/$/, '')}/api/public` : null)
    || (pub.cmsUrl ? `${pub.cmsUrl.replace(/\/$/, '')}/api/public` : null)

  if (!base) {
    throw createError({ statusCode: 500, message: 'CMS URL not configured on this frontend (need cmsApiUrl or cmsUrl)' })
  }

  const { site, slug, token } = getQuery(event)

  try {
    return await $fetch(`${base}/preview`, { query: { site, slug, token } })
  } catch (error: any) {
    const statusCode = error.statusCode || error.status || 500
    const data = error.data || error.response?._data
    throw createError({
      statusCode,
      data,
      message: data?.message || error.message || 'Failed to fetch preview draft',
    })
  }
})
