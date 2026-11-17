/**
 * 档案型面板（mode='archive'）的表单描述符不得拼 `t.[null]`。
 *
 * 生产故障（2026-11-17 用户报「生产模具表」用不了）：
 *   GET /px/getFormDescriptor?panelCode=PROD_MOLD → HTTP 500
 *   SQL: SELECT t.id AS __id, t.[null] AS __no, ...   ← group_col 是 NULL
 *
 * 根因：archive 面板在 yj_panel 里 **group_col = NULL**（维护表没有单据号/单据头，
 * 见 tools/migrate-prod-mold-panel-20261030.sql 注释），而 getFormDescriptor
 * 一律走 loadOneDoc → loadDocs，后者无条件拼 `t.[group_col]`。
 * 列表走的是另一条路（queryArchive：全量行 + 一张虚拟单），所以列表一直正常、
 * 只有表单挂 —— 这类"半通"故障最容易漏。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const facade = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelFacade.java', import.meta.url), 'utf8')
const query = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/QueryService.java', import.meta.url), 'utf8')

test('getFormDescriptor 必须按 mode 分派，archive 走 loadOneArchiveDoc', () => {
  const at = facade.indexOf('public Map<String, Object> getFormDescriptor(')
  assert.ok(at > 0, '缺 getFormDescriptor')
  const seg = facade.slice(at, at + 1200)
  assert.match(seg, /"archive"\.equals\(def\.mode\(\)\)/, '必须判 mode=archive')
  assert.match(seg, /loadOneArchiveDoc/, 'archive 必须走 loadOneArchiveDoc')
  assert.match(seg, /loadOneDoc/, 'doc 面板仍走 loadOneDoc')
})

test('loadOneArchiveDoc 不得引用 groupCol（archive 没有单据号）', () => {
  const at = query.indexOf('public Map<String, Object> loadOneArchiveDoc(')
  assert.ok(at > 0, '缺 loadOneArchiveDoc')
  const seg = query.slice(at, query.indexOf('/** 取一张单据(getFormDescriptor 用) */', at))
  assert.doesNotMatch(seg, /groupCol\(\)/, 'archive 路径不得拼 groupCol（那正是 [null] 的来源）')
  // 形状必须与 queryArchive 一致：编号=面板名 / 状态 / detail.<tabKey>
  assert.match(seg, /doc\.put\("编号"/, '虚拟单要有「编号」= 面板名')
  assert.match(seg, /def\.tabKey\(\)/, '记录必须挂在 detail.<tabKey>')
})
