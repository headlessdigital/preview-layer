/**
 * GET /__preview/draft?site=&slug=&token=
 *
 * Layer-owned server proxy: forwards to the CMS draft/preview endpoint
 * (`${cmsApiUrl}/preview`) server-side so the browser never makes a cross-origin
 * request and the preview token stays server-to-server on the initial load.
 *
 * `cmsApiUrl` is provided by the host theme's runtimeConfig (already `${CMS_URL}/api/public`).
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const base = (config.public as { cmsApiUrl?: string }).cmsApiUrl
  if (!base) {
    throw createError({ statusCode: 500, message: 'cmsApiUrl is not configured on this frontend' })
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
