/**
 * TechRadar — Daily Feed Aggregator
 * Fetches RSS/API feeds, categorizes entries, generates a Markdown digest.
 * Runs via GitHub Actions cron or manually: node scripts/fetch-feeds.js
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'src', 'content', 'feeds');

// ===== FEED SOURCES =====
const FEEDS = [
  { name: 'OpenAI', url: 'https://openai.com/blog/rss.xml', color: '#10a37f' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', color: '#4285f4' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', color: '#ff9d00' },
  { name: 'ArXiv cs.AI', url: 'https://rss.arxiv.org/rss/cs.AI', color: '#b31b1b' },
  { name: 'VS Code', url: 'https://code.visualstudio.com/feed.xml', color: '#007acc' },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/', color: '#238636' },
  { name: 'Microsoft AI', url: 'https://blogs.microsoft.com/ai/feed/', color: '#00a4ef' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', color: '#0a9e01' },
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', color: '#6366f1' },
  { name: 'Lilian Weng', url: 'https://lilianweng.github.io/index.xml', color: '#ec4899' },
  { name: 'BAIR Blog', url: 'https://bair.berkeley.edu/blog/feed.xml', color: '#1d4ed8' },
];

// ===== AUTO-CATEGORIZE =====
const CATEGORY_KEYWORDS = {
  models: ['gpt', 'claude', 'gemini', 'llama', 'mistral', 'model', 'llm', 'qwen', 'deepseek', 'phi-', 'opus', 'sonnet', 'haiku', 'grok', 'benchmark', 'parameters'],
  agents: ['agent', 'agentic', 'langchain', 'langgraph', 'autogen', 'crew', 'tool calling', 'function calling', 'multi-agent', 'smolagent', 'codex'],
  tools: ['copilot', 'cursor', 'vscode', 'vs code', 'ide', 'cli', 'sdk', 'api', 'mcp', 'developer', 'plugin', 'extension'],
  research: ['arxiv', 'paper', 'study', 'survey', 'transformer', 'attention', 'rlhf', 'alignment', 'evaluation', 'rag', 'retrieval', 'embedding'],
  releases: ['release', 'launch', 'update', 'version', 'v1.', 'v2.', 'available', 'changelog', 'shipped', 'generally available'],
};

function categorize(title, summary, sourceName) {
  const text = `${title} ${summary} ${sourceName}`.toLowerCase();
  let best = 'tools';
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

// ===== RSS PARSER =====
function parseRSSItems(xml) {
  const items = [];

  // RSS 2.0 <item>
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1];
    const title = extractTag(content, 'title');
    const link = extractTag(content, 'link') || extractAttr(content, 'link', 'href');
    const desc = extractTag(content, 'description');
    const pubDate = extractTag(content, 'pubDate') || extractTag(content, 'dc:date');
    if (title) {
      items.push({
        title: stripHTML(title),
        url: link?.trim() || '',
        summary: stripHTML(desc).slice(0, 300),
        pubDate: pubDate || '',
      });
    }
  }

  // Atom <entry>
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  while ((match = entryRegex.exec(xml)) !== null) {
    const content = match[1];
    const title = extractTag(content, 'title');
    const link = extractAttr(content, 'link', 'href') || extractTag(content, 'link');
    const summary = extractTag(content, 'summary') || extractTag(content, 'content');
    const updated = extractTag(content, 'updated') || extractTag(content, 'published');
    if (title) {
      items.push({
        title: stripHTML(title),
        url: link?.trim() || '',
        summary: stripHTML(summary).slice(0, 300),
        pubDate: updated || '',
      });
    }
  }
  return items;
}

function extractTag(xml, tag) {
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'));
  if (cdataMatch) return cdataMatch[1];
  const simpleMatch = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return simpleMatch ? simpleMatch[1] : '';
}

function extractAttr(xml, tag, attr) {
  const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

function stripHTML(str) {
  return (str || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

// ===== FETCH A SINGLE FEED =====
async function fetchFeed(source) {
  try {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'TechRadar/1.0 (RSS Aggregator; +https://techradar.tatsat.dev)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      console.warn(`  ⚠️  ${source.name}: HTTP ${response.status}`);
      return [];
    }
    const xml = await response.text();
    const items = parseRSSItems(xml);
    console.log(`  ✅ ${source.name}: ${items.length} items found`);

    // Filter to recent items (last 48h to catch late-published feeds)
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const recent = items.filter(item => {
      if (!item.pubDate) return true; // include if no date (many feeds omit it)
      const d = new Date(item.pubDate);
      return !isNaN(d.getTime()) && d.getTime() > cutoff;
    });

    const picked = (recent.length > 0 ? recent : items).slice(0, 5);
    console.log(`     → ${picked.length} recent entries selected`);

    return picked.map(item => ({
      title: item.title,
      url: item.url,
      source: source.name,
      category: categorize(item.title, item.summary, source.name),
      summary: item.summary || `Latest from ${source.name}`,
      sourceColor: source.color,
    }));
  } catch (err) {
    console.warn(`  ⚠️  ${source.name}: ${err.message}`);
    return [];
  }
}

// ===== YAML-SAFE STRING =====
function yamlEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

// ===== GENERATE MARKDOWN =====
function generateMarkdown(date, entries) {
  const yaml = entries.map(e => `  - title: "${yamlEscape(e.title)}"
    url: "${yamlEscape(e.url)}"
    source: "${yamlEscape(e.source)}"
    category: "${e.category}"
    summary: "${yamlEscape(e.summary)}"
    sourceColor: "${e.sourceColor}"`).join('\n');

  return `---
title: "Daily AI Digest — ${date}"
date: "${date}"
entries:
${yaml}
---

Auto-generated daily digest with ${entries.length} items from ${new Set(entries.map(e => e.source)).size} sources.
`;
}

// ===== MAIN =====
async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`🚀 TechRadar Feed Aggregator — ${today}`);
  console.log(`📡 Fetching from ${FEEDS.length} sources...\n`);

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const entries = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  if (entries.length === 0) {
    console.log('\n⚠️  No entries fetched from any source. Skipping digest generation.');
    process.exit(0);
  }

  console.log(`\n📊 Total: ${entries.length} entries from ${new Set(entries.map(e => e.source)).size} sources`);

  if (!existsSync(CONTENT_DIR)) {
    mkdirSync(CONTENT_DIR, { recursive: true });
  }

  const filepath = join(CONTENT_DIR, `${today}.md`);
  writeFileSync(filepath, generateMarkdown(today, entries), 'utf-8');
  console.log(`📝 Written: ${filepath}`);
  console.log('✅ Done!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
