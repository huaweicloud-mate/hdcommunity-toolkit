// Local content risk-control engine + standalone MCP tool (Issue #3).
//
// Pure local text scanning (title + body) against a word list — no network,
// no paid service. Findings are MARK-ONLY: they never block the review flow.
//
// Word list = built-in seed entries + optional user extension file:
//   $HDCOMMUNITY_RISK_WORDS_FILE or ~/.config/hdcommunity-toolkit/risk-words.json
// Extension entries may be plain strings (category=custom, level=medium) or
// { word, category, level } objects and override built-in entries by word.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ok, fail, CODES } from '../errors.mjs';

const P = {
  str: (description) => ({ type: 'string', description }),
};

// ---------------------------------------------------------------------------
// Word list
// ---------------------------------------------------------------------------

export const CATEGORIES = ['porn', 'gambling', 'drugs', 'politics', 'abuse', 'ads', 'custom'];
export const LEVELS = ['high', 'medium', 'low'];

// Built-in seed word list. Intentionally compact and extendable — production
// deployments should plug a maintained open-source word bank via the
// extension file (see header). Levels reflect violation severity.
const BUILTIN_WORDS = [
  // gambling (赌博) — high
  { word: '赌博', category: 'gambling', level: 'high' },
  { word: '赌场', category: 'gambling', level: 'high' },
  { word: '六合彩', category: 'gambling', level: 'high' },
  { word: '开盘下注', category: 'gambling', level: 'high' },
  { word: '赌球', category: 'gambling', level: 'high' },
  { word: '博彩平台', category: 'gambling', level: 'high' },
  { word: 'ag真人', category: 'gambling', level: 'high' },
  { word: '发牌坐庄', category: 'gambling', level: 'high' },
  { word: '买彩票稳赚', category: 'gambling', level: 'high' },
  { word: '外围赌', category: 'gambling', level: 'high' },
  { word: '百家乐', category: 'gambling', level: 'high' },

  // drugs / illegal goods (毒品、违禁品) — high
  { word: '冰毒', category: 'drugs', level: 'high' },
  { word: '海洛因', category: 'drugs', level: 'high' },
  { word: '大麻购买', category: 'drugs', level: 'high' },
  { word: '摇头丸', category: 'drugs', level: 'high' },
  { word: 'k粉', category: 'drugs', level: 'high' },
  { word: '迷奸药', category: 'drugs', level: 'high' },
  { word: '买卖枪支', category: 'drugs', level: 'high' },
  { word: '枪支买卖', category: 'drugs', level: 'high' },
  { word: '办假证', category: 'drugs', level: 'high' },
  { word: '代开发票', category: 'drugs', level: 'high' },
  { word: '假钞', category: 'drugs', level: 'high' },
  { word: '出售麻醉枪', category: 'drugs', level: 'high' },

  // porn (色情低俗) — high
  { word: '裸聊', category: 'porn', level: 'high' },
  { word: '援交', category: 'porn', level: 'high' },
  { word: '一夜情服务', category: 'porn', level: 'high' },
  { word: '嫖娼', category: 'porn', level: 'high' },
  { word: '卖淫', category: 'porn', level: 'high' },
  { word: '约炮', category: 'porn', level: 'high' },
  { word: '色情资源', category: 'porn', level: 'high' },
  { word: '成人影片下载', category: 'porn', level: 'high' },
  { word: '无码种子', category: 'porn', level: 'high' },
  { word: '外围女', category: 'porn', level: 'high' },

  // politics (政治敏感) — medium
  { word: '法轮功', category: 'politics', level: 'medium' },
  { word: '全能神教', category: 'politics', level: 'medium' },
  { word: '邪教招募', category: 'politics', level: 'medium' },
  { word: '推翻政权', category: 'politics', level: 'medium' },
  { word: '疆独', category: 'politics', level: 'medium' },
  { word: '藏独', category: 'politics', level: 'medium' },
  { word: '台独分子', category: 'politics', level: 'medium' },

  // abuse (辱骂攻击) — medium
  { word: '傻逼', category: 'abuse', level: 'medium' },
  { word: '脑残', category: 'abuse', level: 'medium' },
  { word: '废物东西', category: 'abuse', level: 'medium' },
  { word: '去死吧', category: 'abuse', level: 'medium' },
  { word: '全家死', category: 'abuse', level: 'medium' },

  // ads / diversion (广告引流) — low
  { word: '加微信低价', category: 'ads', level: 'low' },
  { word: '扫码进群', category: 'ads', level: 'low' },
  { word: '点击领取红包', category: 'ads', level: 'low' },
  { word: '代理刷单', category: 'ads', level: 'low' },
  { word: '兼职日结上千', category: 'ads', level: 'low' },
  { word: '私聊带货', category: 'ads', level: 'low' },
];

/** @returns {string} extension file path (env override > default config path) */
function extensionFilePath() {
  return process.env.HDCOMMUNITY_RISK_WORDS_FILE || join(homedir(), '.config', 'hdcommunity-toolkit', 'risk-words.json');
}

function normalizeEntry(entry) {
  if (typeof entry === 'string' && entry.trim()) {
    return { word: entry.trim(), category: 'custom', level: 'medium' };
  }
  if (entry && typeof entry === 'object' && typeof entry.word === 'string' && entry.word.trim()) {
    const category = CATEGORIES.includes(entry.category) ? entry.category : 'custom';
    const level = LEVELS.includes(entry.level) ? entry.level : 'medium';
    return { word: entry.word.trim(), category, level };
  }
  return null;
}

/**
 * Load the effective word list: built-in seed + extension file (merged,
 * extension entries override built-in ones by word). Never throws — a broken
 * extension file degrades to the built-in list with a note.
 *
 * @returns {{ entries: Array<{word,category,level}>, sources: string[], note?: string }}
 */
export function loadRiskWords() {
  const byWord = new Map();
  for (const e of BUILTIN_WORDS) byWord.set(e.word, e);
  const sources = ['builtin'];

  let path = null;
  try {
    path = extensionFilePath();
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const list = Array.isArray(raw) ? raw : Array.isArray(raw.words) ? raw.words : null;
    if (!list) throw new Error('expected a JSON array or { words: [...] }');
    let loaded = 0;
    for (const item of list) {
      const entry = normalizeEntry(item);
      if (entry) {
        byWord.set(entry.word, entry);
        loaded++;
      }
    }
    if (loaded > 0) sources.push('file');
  } catch (e) {
    const missing = e && e.code === 'ENOENT';
    if (!missing) {
      return {
        entries: [...byWord.values()],
        sources,
        note: `extension file ignored (${path}: ${e.message}); using built-in list`,
      };
    }
  }
  return { entries: [...byWord.values()], sources };
}

// ---------------------------------------------------------------------------
// Normalization + trie matching
// ---------------------------------------------------------------------------

// Evade tricks: full-width chars, casing, embedded whitespace/zero-width marks.
const ZERO_WIDTH = /[\u200b-\u200f\u2060\ufeff]/g;

/** Normalize text for matching (NFKC folds full-width -> half-width; lowercase; strip separators). */
export function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(ZERO_WIDTH, '')
    .replace(/[\s\u3000·•・∙]/g, ''); // spaces + middle-dot fillers between chars
}

let trieCache = null;

/** Build (and cache) the matching trie from the effective word list. */
function getTrie() {
  if (trieCache) return trieCache;
  const { entries, sources, note } = loadRiskWords();
  const root = {};
  for (const { word, category, level } of entries) {
    const key = normalizeText(word);
    if (!key) continue;
    let node = root;
    for (const ch of key) node = node[ch] ||= {};
    node.$ = { word, category, level };
  }
  trieCache = { root, size: entries.length, sources, note };
  return trieCache;
}

/** Test-only: drop the cached trie (after swapping the extension file in tests). */
export function resetRiskEngineCache() {
  trieCache = null;
}

/** Scan one normalized field; accumulate hits into `acc` (keyed by word+field). */
function scanField(text, field, acc, counter) {
  const s = normalizeText(text);
  const { root } = getTrie();
  for (let i = 0; i < s.length; i++) {
    let node = root;
    let j = i;
    while (node && j < s.length) {
      node = node[s[j]];
      if (!node) break;
      j++;
      if (node.$) {
        const info = node.$;
        const key = `${info.word}|${field}`;
        const hit = acc.get(key) || { word: info.word, category: info.category, level: info.level, field, count: 0, _o: counter.n++ };
        hit.count++;
        acc.set(key, hit);
      }
    }
  }
}

const LEVEL_RANK = { none: 0, low: 1, medium: 2, high: 3 };

/** Overall risk level from hit levels (high wins; low-level spam >=3 hits escalates). */
function overallLevel(hits) {
  if (!hits.length) return 'none';
  const has = (l) => hits.some((h) => h.level === l);
  if (has('high')) return 'high';
  if (has('medium')) return 'medium';
  const lowCount = hits.reduce((n, h) => n + (h.level === 'low' ? h.count : 0), 0);
  if (lowCount >= 3) return 'medium'; // ad-spam patterns (repeats count)
  return 'low';
}

const SUGGESTIONS = {
  high: '存在高风险违规内容（黄赌毒/违禁品类），建议人工重点复核，必要时驳回',
  medium: '存在中风险内容（政治敏感/辱骂/刷屏广告），建议人工复核后决定',
  low: '存在轻微风险内容（零星广告引流），建议留意',
  none: '未命中已知违规词，可按正常流程审核',
};

/**
 * Scan a blog's title + content and produce a MARK-ONLY risk report.
 * @param {string} [title]
 * @param {string} [content]
 * @returns {object} risk report (never throws)
 */
export function scanBlog(title, content) {
  const acc = new Map();
  const counter = { n: 0 };
  if (title) scanField(title, 'title', acc, counter);
  if (content) scanField(content, 'content', acc, counter);

  const hits = [...acc.values()]
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a._o - b._o)
    .map(({ _o, ...hit }) => hit);

  const riskLevel = overallLevel(hits);
  const { size, sources, note } = getTrie();
  const report = {
    status: 'done',
    risk_level: riskLevel,
    passed: riskLevel === 'none' || riskLevel === 'low',
    categories: [...new Set(hits.map((h) => h.category))],
    hit_count: hits.reduce((n, h) => n + h.count, 0),
    hits,
    wordlist: { source: sources.join('+'), size },
    suggestion: SUGGESTIONS[riskLevel],
  };
  if (note) report.wordlist.note = note;
  return report;
}

// ---------------------------------------------------------------------------
// Integration helper for the review tools (admin-tools.mjs)
// ---------------------------------------------------------------------------

const SKIPPED_HINT =
  '未提供待审文本：调用 review 时传入 title/content（batch 传 items:[{id,title,content}]）即可自动风控，或单独调用 hdcommunity_admin_blog_risk_check';

/**
 * Attach a risk report to a review tool result. Never throws — engine errors
 * degrade to { status: "error" } so the review itself is never blocked.
 * @param {{ok: boolean, data?: any, error?: any}} result review result
 * @param {string|undefined} title
 * @param {string|undefined} content
 */
export function attachRiskCheck(result, title, content) {
  let riskCheck;
  try {
    if (!title && !content) {
      riskCheck = { status: 'skipped', reason: SKIPPED_HINT };
    } else {
      riskCheck = scanBlog(title, content);
    }
  } catch (e) {
    riskCheck = { status: 'error', message: `风控引擎异常（不影响审核）: ${e.message}` };
  }
  if (result && result.ok) {
    result.data = { ...(result.data ?? {}), risk_check: riskCheck };
  } else if (result) {
    result.risk_check = riskCheck; // keep visible even when review failed
  }
  return result;
}

/** Aggregate per-item reports for batch review. */
export function summarizeBatchRisk(reports) {
  const done = reports.filter((r) => r && r.status === 'done');
  const levels = done.map((r) => r.risk_level);
  const overall = ['high', 'medium', 'low'].find((l) => levels.includes(l)) || 'none';
  return {
    status: 'done',
    overall_risk_level: overall,
    checked: done.length,
    flagged: done.filter((r) => r.risk_level !== 'none').length,
  };
}

// ---------------------------------------------------------------------------
// Standalone MCP tool
// ---------------------------------------------------------------------------

export const RISK_TOOLS = {
  definitions: [
    {
      name: 'hdcommunity_admin_blog_risk_check',
      description:
        'Run local content risk control on a blog title/content (mark-only, no blocking, no backend call). 博客内容风控检查：输出风险等级与违规类型，供审核参考。',
      inputSchema: {
        type: 'object',
        properties: {
          title: P.str('博客标题（可选，与 content 至少一项）'),
          content: P.str('博客正文（可选，与 title 至少一项）'),
        },
      },
    },
  ],

  call: {
    'hdcommunity_admin_blog_risk_check': (a) => {
      if (!a.title && !a.content) {
        return fail(CODES.PARAM_ERROR, 'title 与 content 至少提供一项');
      }
      return ok(scanBlog(a.title, a.content));
    },
  },
};
