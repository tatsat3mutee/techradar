/**
 * TechRadar — VS Code Release Tracker
 * Fetches the latest VS Code release notes from the official RSS feed
 * and generates/updates a Markdown page in content/feeds.
 * Can be run standalone or integrated into the daily digest workflow.
 *
 * Usage: node scripts/fetch-vscode-updates.js
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'src', 'content', 'feeds');
const DATA_FILE = join(__dirname, '..', 'src', 'data', 'vscode-latest.json');

const VSCODE_RSS = 'https://code.visualstudio.com/feed.xml';
const VSCODE_API = 'https://api.github.com/repos/microsoft/vscode/releases?per_page=5';

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TechRadar/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'TechRadar/1.0',
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = xml.match(regex);
  return m ? (m[1] || m[2] || '').trim() : '';
}

async function getLatestFromRSS() {
  try {
    const xml = await fetchText(VSCODE_RSS);
    const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
    if (!itemMatch) return null;
    const item = itemMatch[1];
    const rawDesc = extractTag(item, 'description');
    const cleanDesc = rawDesc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim().slice(0, 300);
    return {
      title: extractTag(item, 'title'),
      link: extractTag(item, 'link'),
      date: extractTag(item, 'pubDate'),
      description: cleanDesc,
    };
  } catch (e) {
    console.warn('RSS fetch failed, falling back to GitHub API:', e.message);
    return null;
  }
}

async function getLatestFromGitHub() {
  try {
    const releases = await fetchJSON(VSCODE_API);
    const latest = releases.find(r => !r.prerelease && !r.draft);
    if (!latest) return null;
    return {
      version: latest.tag_name,
      date: latest.published_at,
      url: latest.html_url,
      name: latest.name,
      body: (latest.body || '').slice(0, 500),
    };
  } catch (e) {
    console.warn('GitHub API fetch failed:', e.message);
    return null;
  }
}

function extractVersion(title) {
  const m = title.match(/(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : 'unknown';
}

async function main() {
  console.log('🔍 Fetching VS Code updates...');

  const [rss, gh] = await Promise.all([getLatestFromRSS(), getLatestFromGitHub()]);

  const version = rss ? extractVersion(rss.title) : gh?.version?.replace('v', '') || 'unknown';
  const date = rss?.date ? new Date(rss.date).toISOString().split('T')[0] : gh?.date?.split('T')[0] || new Date().toISOString().split('T')[0];
  const link = rss?.link || gh?.url || 'https://code.visualstudio.com/updates';
  const description = rss?.description || gh?.body || '';

  // Save structured data for the Astro page to consume
  const dataDir = dirname(DATA_FILE);
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const data = {
    version,
    date,
    link,
    description: description.slice(0, 300),
    fetchedAt: new Date().toISOString(),
    source: rss ? 'rss' : gh ? 'github' : 'none',
  };

  // Read existing data to check if version changed
  let existing = null;
  if (existsSync(DATA_FILE)) {
    try {
      existing = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    } catch { /* ignore parse errors */ }
  }

  if (existing?.version === version) {
    console.log(`✅ VS Code ${version} — no change since last fetch`);
    return;
  }

  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`✅ VS Code ${version} (${date}) — saved to ${DATA_FILE}`);

  // Also append to today's feed digest if it exists
  if (!existsSync(CONTENT_DIR)) mkdirSync(CONTENT_DIR, { recursive: true });
  const todayFile = join(CONTENT_DIR, `${date}.md`);
  if (existsSync(todayFile)) {
    const content = readFileSync(todayFile, 'utf-8');
    if (!content.includes(`VS Code ${version}`)) {
      const entry = `\n- 🔧 **VS Code ${version}** released — [Release Notes](${link})\n`;
      writeFileSync(todayFile, content + entry);
      console.log(`📝 Appended VS Code update to ${todayFile}`);
    }
  }
}

main().catch(err => {
  console.error('❌ VS Code fetch failed:', err);
  process.exit(1);
});
