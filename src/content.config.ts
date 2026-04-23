import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const feeds = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/feeds' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    entries: z.array(z.object({
      title: z.string(),
      url: z.string(),
      source: z.string(),
      category: z.enum(['models', 'agents', 'tools', 'research', 'releases', 'video']),
      summary: z.string(),
      sourceColor: z.string().optional(),
    })),
  }),
});

const sessions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/sessions' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    author: z.string().default('Tatsat Pandey'),
    tags: z.array(z.string()),
    bannerGradient: z.string().optional(),
    featured: z.boolean().default(false),
    link: z.string().optional(),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    author: z.string().default('Tatsat Pandey'),
    tags: z.array(z.string()),
    featured: z.boolean().default(false),
  }),
});

export const collections = { feeds, sessions, articles };
