/**
 * extFieldPool.test.js —— 「表没有备用列池」必须被识别出来,而不是当成"池里 0 个空位"
 *
 * 钉子来源(2026-10-16 研发管理 26 面板审计):RD_SHARE_FILE(共享文件库)与 QC_FIN_SPEC 的承载表
 * 没有预置 备用1..20,后端逐列 `SELECT COUNT(*) FROM 表 WHERE [备用N] IS NOT NULL` 直接 500,
 * 用户只看到 "Request failed with status code 500"。后端改成下发空池后,前端这一层要负责说人话。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { poolUnavailableOf } from './extFieldPool.js'

test('两池都空 → 判定为"没有备用列池"(表缺列,不是没空位)', () => {
  assert.equal(poolUnavailableOf({ capacity: 20, fields: [], linePool: [], headPool: [] }, false), true)
  assert.equal(poolUnavailableOf({ capacity: 20, fields: [] }, false), true, '两个池字段都没有(老响应)也算无池')
})

test('池存在但被占满 → 不算"无池"(空位为 0 是另一回事,提示文案不同)', () => {
  const full = Array.from({ length: 20 }, (_, i) => ({ col: '备用' + (i + 1), bound: 'x' }))
  assert.equal(poolUnavailableOf({ capacity: 20, fields: [], linePool: full, headPool: full }, false), false)
})

test('正常有池(false)与后端显式声明(true)都按预期', () => {
  const pool = Array.from({ length: 20 }, (_, i) => ({ col: '备用' + (i + 1), bound: null }))
  assert.equal(poolUnavailableOf({ capacity: 20, fields: [], linePool: pool, headPool: pool }, false), false)
  assert.equal(poolUnavailableOf({ capacity: 20, fields: [], linePool: pool, headPool: pool, poolAvailable: false }, false), true,
    '后端显式 poolAvailable=false 优先')
})

test('分页签面板:按 tabPools 有没有段来判', () => {
  assert.equal(poolUnavailableOf({ capacity: 20, fields: [], tabPools: { A: { used: 0, capacity: 20 } } }, true), false)
  assert.equal(poolUnavailableOf({ capacity: 20, fields: [], tabPools: {} }, true), true)
  assert.equal(poolUnavailableOf({ capacity: 20, fields: [] }, true), true)
})

test('空/非法输入不抛错', () => {
  assert.equal(poolUnavailableOf(null, false), true)
  assert.equal(poolUnavailableOf(undefined, true), true)
  assert.equal(poolUnavailableOf({ linePool: 'x', headPool: null }, false), true)
})
