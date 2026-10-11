import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig(({ isPreview }) => ({
  worker: defineWorker({
    name: "dev-tools",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
    },
    // Preview の Build Output に本番の custom domain と公開設定を持ち込まない。
    ...(isPreview
      ? {}
      : {
          domains: ["dev-tools.tanakalucky.com"],
          workersDev: false,
          previewUrls: true,
        }),
  }),
}));
