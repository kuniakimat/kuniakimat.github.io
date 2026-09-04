// lib.mjs — 台帳の読み込みと共通処理
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import matter from 'gray-matter';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const p = (...a) => path.join(ROOT, ...a);

export function loadYaml(rel) {
  const f = p(rel);
  if (!fs.existsSync(f)) return {};
  return yaml.load(fs.readFileSync(f, 'utf8')) || {};
}

export function loadData() {
  return {
    registry: loadYaml('data/registry.yml'),
    links: loadYaml('data/links.yml'),
    canon: loadYaml('data/canon.yml'),
  };
}

/** content/ 以下の Markdown をすべて読む */
export function loadContent() {
  const out = [];
  const sections = ['articles', 'frameworks', 'stories', 'reports'];
  for (const sec of sections) {
    const dir = p('content', sec);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.md') || name.startsWith('_')) continue;
      const raw = fs.readFileSync(path.join(dir, name), 'utf8');
      const { data, content } = matter(raw);
      const slug = data.slug || name.replace(/\.md$/, '');
      out.push({
        ...data,
        section: sec,
        slug,
        file: path.join('content', sec, name),
        body: content,
        id: data.id || `${sec.slice(0, 3)}-${slug}`,
        status: data.status || 'draft',
      });
    }
  }
  return out;
}

/** ID から公開 URL を引く。本文に URL を書かないための唯一の入口 */
export function makeResolver({ registry, links }, docs) {
  const byId = new Map();
  for (const [id, v] of Object.entries(registry)) byId.set(id, { ...v, id, source: 'registry' });
  for (const [id, v] of Object.entries(links)) byId.set(id, { ...v, id, source: 'links' });
  for (const d of docs) {
    byId.set(d.id, {
      id: d.id,
      title: d.title,
      url: docUrl(d),
      source: 'content',
      status: d.status,
      external: d.external,
    });
  }
  return {
    get: (id) => byId.get(id) || null,
    all: () => [...byId.values()],
    has: (id) => byId.has(id),
  };
}

export function docUrl(d) {
  if (d.status === 'preview') return `/p/${d.previewKey || d.slug}/`;
  return `/${d.section}/${d.slug}/`;
}

export function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function write(rel, text) {
  const f = p(rel);
  ensureDir(path.dirname(f));
  fs.writeFileSync(f, text);
}

// マウントされたフォルダでは権限のコピーが通らないので、中身だけを写す
export function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name);
    const dst = path.join(to, e.name);
    if (e.isDirectory()) copyDir(src, dst);
    else if (e.isFile()) fs.writeFileSync(dst, fs.readFileSync(src));
  }
}
