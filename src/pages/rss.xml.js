import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const allFeeds = await getCollection('feeds');
  const sorted = allFeeds.sort((a, b) => b.data.date.localeCompare(a.data.date));

  // Flatten all feed entries into RSS items
  const items = sorted.flatMap(feed =>
    feed.data.entries.map(entry => ({
      title: entry.title,
      link: entry.url,
      description: entry.summary,
      pubDate: new Date(feed.data.date),
      categories: [entry.category, entry.source],
    }))
  );

  return rss({
    title: 'TechRadar — Daily AI Feed',
    description: 'Aggregated AI & tech news from OpenAI, Anthropic, Google DeepMind, Meta AI, Hugging Face, ArXiv, GitHub, and more.',
    site: context.site,
    items,
    customData: '<language>en-us</language>',
  });
}
