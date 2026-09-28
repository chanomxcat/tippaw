import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});

export default {
  ...config,
  // Without this, OpenNext defaults to `npm run build`, which is this
  // project's own `opennextjs-cloudflare build` script — an infinite loop.
  buildCommand: "npx next build",
};
