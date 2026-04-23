/**
 * TechRadar — Model Release Detector
 * Scans vendor RSS feeds for new model announcements.
 * Compares against known-models.json registry.
 * Flags new detections in the daily digest + model-alerts.json.
 *
 * Usage: node scripts/detect-model-releases.js
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');
const KNOWN_FILE = join(DATA_DIR, 'known-models.json');
const ALERTS_FILE = join(DATA_DIR, 'model-alerts.json');
const FEEDS_DIR = join(__dirname, '..', 'src', 'content', 'feeds');

// Vendor feeds most likely to announce new models
const MODEL_FEEDS = [
  { name: 'OpenAI', url: 'https://openai.com/blog/rss.xml' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/' },
  { name: 'Microsoft AI', url: 'https://blogs.microsoft.com/ai/feed/' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
];

// Patterns that indicate a model announcement
const MODEL_PATTERNS = [
  /\bintroducing\s+([\w\s\-.]+\d[\w\s\-.]*)/i,
  /\bannouncing\s+([\w\s\-.]+\d[\w\s\-.]*)/i,
  /\blaunching\s+([\w\s\-.]+\d[\w\s\-.]*)/i,
  /\breleasing\s+([\w\s\-.]+\d[\w\s\-.]*)/i,
  /\b(GPT[‑\-]?\d[\w\-.]*)/i,
  /\b(Claude\s+[\w\s]+\d[\w.]*)/i,
  /\b(Gemini\s+\d[\w.\s]*)/i,
  /\b(Llama\s+\d[\w.\s]*)/i,
  /\b(Grok\s+\d[\w.]*)/i,
  /\b(DeepSeek[‑\-]?[\w]+\d?)/i,
  /\b(Qwen\d[\w\-.]*)/i,
  /\b(Mistral\s+[\w\s]+\d[\w.]*)/i,
  /\b(Phi[‑\-]?\d[\w.]*)/i,
  /\b(o\d[‑\-]?\w*)/i,
  /\b(Command\s+R[\w+]*)/i,
  /\b(GPT[‑\-]?\d[\w\-.]*[Cc]odex)/i,
];

// Words that are NOT model names but match patterns
const FALSE_POSITIVES = [
  'o2', 'o1', 'the', 'our', 'its', 'for', 'on', 'Codex CLI',
  'Codex agent', 'Codex to', 'Codex for', 'Codex Labs',
  'Codex-powered', 'Codex powered',
];

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TechRadar/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
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
  return (str || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function parseItems(xml) {
  const items = [];
  // RSS 2.0
  let match;
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  while ((match = itemRe.exec(xml)) !== null) {
    const c = match[1];
    items.push({
      title: stripHTML(extractTag(c, 'title')),
      link: extractTag(c, 'link')?.trim() || extractAttr(c, 'link', 'href'),
      desc: stripHTML(extractTag(c, 'description')).slice(0, 500),
      date: extractTag(c, 'pubDate') || extractTag(c, 'dc:date'),
    });
  }
  // Atom
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  while ((match = entryRe.exec(xml)) !== null) {
    const c = match[1];
    items.push({
      title: stripHTML(extractTag(c, 'title')),
      link: extractAttr(c, 'link', 'href')?.trim() || extractTag(c, 'link'),
      desc: stripHTML(extractTag(c, 'summary') || extractTag(c, 'content')).slice(0, 500),
      date: extractTag(c, 'updated') || extractTag(c, 'published'),
    });
  }
  return items;
}

function normalizeModelName(raw) {
  return raw
    .replace(/[‑–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-.+]/g, '')
    .trim();
}

function detectModels(text) {
  const found = new Set();
  for (const pattern of MODEL_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const name = normalizeModelName(m[1] || m[0]);
      if (name.length > 1 && !FALSE_POSITIVES.includes(name)) {
        found.add(name);
      }
    }
  }
  return [...found];
}

function isKnown(modelName, knownList) {
  const lower = modelName.toLowerCase();
  return knownList.some(k => {
    const kl = k.toLowerCase();
    return kl === lower || lower.includes(kl) || kl.includes(lower);
  });
}

async function main() {
  console.log('🔍 Scanning for new model releases...\n');

  // Load known models
  let known = { lastUpdated: '', models: [] };
  if (existsSync(KNOWN_FILE)) {
    known = JSON.parse(readFileSync(KNOWN_FILE, 'utf-8'));
  }

  const cutoff = Date.now() - 72 * 60 * 60 * 1000; // 72h lookback
  const alerts = [];

  for (const feed of MODEL_FEEDS) {
    try {
      const xml = await fetchText(feed.url);
      const items = parseItems(xml);

      // Filter recent
      const recent = items.filter(item => {
        if (!item.date) return true;
        const d = new Date(item.date);
        return !isNaN(d.getTime()) && d.getTime() > cutoff;
      }).slice(0, 10);

      for (const item of recent) {
        const text = `${item.title} ${item.desc}`;
        const detected = detectModels(text);

        for (const model of detected) {
          if (!isKnown(model, known.models)) {
            console.log(`  🆕 NEW MODEL: "${model}" from ${feed.name}`);
            console.log(`     → ${item.title}`);
            console.log(`     → ${item.link}\n`);
            alerts.push({
              model,
              source: feed.name,
              title: item.title,
              url: item.link,
              date: item.date || new Date().toISOString(),
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
      console.log(`  ✅ ${feed.name}: scanned ${recent.length} items`);
    } catch (e) {
      console.warn(`  ⚠️  ${feed.name}: ${e.message}`);
    }
  }

  // Deduplicate alerts by model name
  const unique = [];
  const seen = new Set();
  for (const a of alerts) {
    const key = a.model.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
  }

  // Save alerts
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  // Merge with existing alerts (keep last 30 days)
  let existing = [];
  if (existsSync(ALERTS_FILE)) {
    try {
      existing = JSON.parse(readFileSync(ALERTS_FILE, 'utf-8'));
    } catch { /* ignore */ }
  }
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const merged = [...unique, ...existing]
    .filter(a => new Date(a.detectedAt).getTime() > thirtyDaysAgo)
    .slice(0, 50);

  writeFileSync(ALERTS_FILE, JSON.stringify(merged, null, 2));

  // Append to today's digest
  if (unique.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const digestFile = join(FEEDS_DIR, `${today}.md`);
    if (existsSync(digestFile)) {
      let content = readFileSync(digestFile, 'utf-8');
      if (!content.includes('🆕 New Model Detected')) {
        const banner = '\n\n---\n\n## 🆕 New Model Detected\n\n' +
          unique.map(a => `- **${a.model}** — spotted in [${a.source}](${a.url}): _${a.title}_`).join('\n') +
          '\n\n> ⚠️ Auto-detected from RSS. Verify and update the [Model Tracker](/models) manually.\n';
        writeFileSync(digestFile, content + banner);
        console.log(`\n📝 Added ${unique.length} alert(s) to ${digestFile}`);
      }
    }
  }

  console.log(`\n✅ Done. ${unique.length} new model(s) detected, ${merged.length} total alerts on file.`);
}

main().catch(err => {
  console.error('❌ Model detection failed:', err);
  process.exit(1);
});
