// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://tatsat3mutee.github.io',
  base: '/techradar',
  integrations: [sitemap()],
});
