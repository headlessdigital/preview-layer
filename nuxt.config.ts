export default defineNuxtConfig({
  // Match the frontends in this pattern (srcDir = app/) so this layer's
  // app/pages/__preview.vue is scanned correctly when merged via `extends`.
  future: {
    compatibilityVersion: 4,
  },

  routeRules: {
    // Preview must be dynamic (never the prerendered/cached shell) and never indexed.
    // Themes in this pattern set '/**': { prerender: true } — these more-specific
    // rules win and keep the previewer live-rendering the draft on every load.
    '/__preview': { prerender: false, ssr: true, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/__preview/**': { prerender: false, ssr: true, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
  },

  runtimeConfig: {
    public: {
      // Origin allowed to postMessage into the previewer (the CMS editor's origin).
      // Optional: if unset, the preview page derives it from the theme's cmsApiUrl.
      cmsOrigin: process.env.CMS_ORIGIN || '',
    },
  },
})
