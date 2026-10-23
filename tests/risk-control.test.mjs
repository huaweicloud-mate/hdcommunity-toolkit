// Tests for the local content risk-control engine and its tool wiring (Issue #3).
// Pure local: no network, no paid service. Uses node:test (Node >= 22 built-in).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  normalizeText,
  scanBlog,
  loadRiskWords,
  attachRiskCheck,
  summarizeBatchRisk,
  resetRiskEngineCache,
} from '../src/tools/risk-control.mjs';
import { callTool, TOOL_DEFINITIONS } from '../src/tools/index.mjs';

// Isolate word-list loading from the host user config: point the extension
// file at a non-existent temp path unless a test provides one.
const tmpDir = mkdtempSync(join(tmpdir(), 'risk-words-test-'));
const absentFile = join(tmpDir, 'absent.json');

function useWordFile(content) {
  const p = join(tmpDir, 'ext.json');
  writeFileSync(p, content, 'utf8');
  process.env.HDCOMMUNITY_RISK_WORDS_FILE = p;
  resetRiskEngineCache();
  return p;
}

function useNoWordFile() {
  process.env.HDCOMMUNITY_RISK_WORDS_FILE = absentFile;
  resetRiskEngineCache();
}

test('setup: isolated word-list env', () => {
  useNoWordFile();
});

test('normalizeText folds case, width, separators and zero-width marks', () => {
  assert.equal(normalizeText('ＧＡＭＢＬＥ'), 'gamble');
  assert.equal(normalizeText('　赌 博 '), '赌博');
  assert.equal(normalizeText('赌\u200b博'), '赌博');
  assert.equal(normalizeText('赌·博'), '赌博');
  assert.equal(normalizeText(undefined), '');
  assert.equal(normalizeText(null), '');
});

test('clean text passes with risk_level none', () => {
  const r = scanBlog('云原生架构实践', '本文分享 Kubernetes 上的混沌工程实践。');
  assert.equal(r.risk_level, 'none');
  assert.equal(r.passed, true);
  assert.deepEqual(r.categories, []);
  assert.equal(r.status, 'done');
});

test('gambling category yields high risk', () => {
  const r = scanBlog('稳赚攻略', '欢迎来赌场 开盘下注');
  assert.equal(r.risk_level, 'high');
  assert.equal(r.passed, false);
  assert.ok(r.categories.includes('gambling'));
  const hit = r.hits.find((h) => h.word === '赌场');
  assert.equal(hit.field, 'content');
});

test('title hits are attributed to the title field', () => {
  const r = scanBlog('冰毒危害科普', '正文没有任何敏感内容');
  assert.equal(r.risk_level, 'high');
  const hit = r.hits.find((h) => h.word === '冰毒');
  assert.equal(hit.field, 'title');
});

test('repeated occurrences are counted per word', () => {
  const r = scanBlog('', '赌博 赌博 又赌博');
  assert.equal(r.hits.find((h) => h.word === '赌博').count, 3);
  assert.equal(r.hit_count, 3);
});

test('politics and abuse map to medium risk', () => {
  assert.equal(scanBlog('警惕邪教招募', '').risk_level, 'medium');
  assert.equal(scanBlog('', '你这个脑残').risk_level, 'medium');
});

test('few ad hits stay low, repeated low-level hits escalate to medium', () => {
  assert.equal(scanBlog('', '扫码进群').risk_level, 'low');
  assert.equal(scanBlog('', '扫码进群 加微信低价 私聊带货').risk_level, 'medium');
  assert.equal(scanBlog('', '扫码进群 扫码进群 又扫码进群').risk_level, 'medium'); // same word, 3 hits
});

test('evasion via separators / width is still caught', () => {
  assert.equal(scanBlog('ＧＡＭＢＬＥ 网址', '').hits.length, 0); // latin seed absent by design
  assert.equal(scanBlog('来　赌　博', '').risk_level, 'high');
  assert.equal(scanBlog('裸\u200b聊', '').risk_level, 'high');
});

test('extension file adds custom words (string entries)', () => {
  useWordFile(JSON.stringify(['内部黑话词']));
  const r = scanBlog('标题正常', '正文出现内部黑话词');
  assert.equal(r.risk_level, 'medium');
  assert.equal(r.hits[0].category, 'custom');
  assert.ok(r.wordlist.source.includes('file'));
});

test('extension object entries carry category/level and override built-in', () => {
  useWordFile(JSON.stringify([
    { word: '赌博', category: 'ads', level: 'low' },
    { word: '自定义高危词', category: 'drugs', level: 'high' },
  ]));
  const r = scanBlog('赌博入门', '提到自定义高危词');
  assert.equal(r.risk_level, 'high'); // escalated by the custom high-level word
  const gambling = r.hits.find((h) => h.word === '赌博');
  assert.equal(gambling.category, 'ads');
  assert.equal(gambling.level, 'low');
});

test('broken extension file degrades to built-in list with a note', () => {
  useWordFile('{ not valid json');
  const { entries, sources, note } = loadRiskWords();
  assert.ok(entries.length > 0);
  assert.deepEqual(sources, ['builtin']);
  assert.ok(note.includes('extension file ignored'));
  const r = scanBlog('赌场', '');
  assert.equal(r.risk_level, 'high');
  assert.ok(r.wordlist.note);
});

test('standalone tool is registered and callable without network', async () => {
  useNoWordFile();
  assert.ok(TOOL_DEFINITIONS.some((t) => t.name === 'hdcommunity_admin_blog_risk_check'));

  const r = await callTool('hdcommunity_admin_blog_risk_check', { title: '裸聊', content: '正常正文' });
  assert.equal(r.ok, true);
  assert.equal(r.data.risk_level, 'high');
  assert.ok(r.data.suggestion.length > 0);
});

test('standalone tool rejects empty input', async () => {
  const r = await callTool('hdcommunity_admin_blog_risk_check', {});
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'PARAM_ERROR');
});

test('review tool merges risk_check even when the backend call fails (mark-only, never blocks)', async () => {
  useNoWordFile();
  // No admin session -> callAdmin returns UNAUTHORIZED without touching the network;
  // the risk check must still be attached to the result.
  const r = await callTool('hdcommunity_admin_blog_review', { id: 1, action: 'approve', title: '赌博' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'UNAUTHORIZED');
  assert.equal(r.risk_check.risk_level, 'high');
});

test('attachRiskCheck merges into successful review results', () => {
  useNoWordFile();
  const r = { ok: true, data: { affected: 1 } };
  attachRiskCheck(r, '正常标题', '来赌场');
  assert.equal(r.data.affected, 1);
  assert.equal(r.data.risk_check.risk_level, 'high');
});

test('attachRiskCheck skips with guidance when no text provided', () => {
  useNoWordFile();
  const r = { ok: true, data: {} };
  attachRiskCheck(r);
  assert.equal(r.data.risk_check.status, 'skipped');
  assert.ok(r.data.risk_check.reason.includes('hdcommunity_admin_blog_risk_check'));
});

test('summarizeBatchRisk aggregates per-item levels', () => {
  const s = summarizeBatchRisk([
    { status: 'done', risk_level: 'none' },
    { status: 'done', risk_level: 'low' },
    { status: 'done', risk_level: 'high' },
    null,
  ]);
  assert.equal(s.overall_risk_level, 'high');
  assert.equal(s.checked, 3);
  assert.equal(s.flagged, 2);
});

test('cleanup: temp dir and env', () => {
  delete process.env.HDCOMMUNITY_RISK_WORDS_FILE;
  resetRiskEngineCache();
  rmSync(tmpDir, { recursive: true, force: true });
});
