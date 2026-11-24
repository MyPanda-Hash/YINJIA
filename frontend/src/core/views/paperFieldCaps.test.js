/**
 * 纸面字数上限必须 = 物理列容量（2026-11-24 全面扫描后加的守卫）。
 *
 * 【为什么】用户报障「红框的位置这个单据没有办法进行一个修改，输入内容」——
 *   根因是纸面配置的 `max`（渲染成 textarea 的 `maxlength`）比库列容量小：
 *   内容一旦写满 max，浏览器就拒收后续输入，看上去像"这一格锁了"，
 *   而**只有内容写满的那张单**才会出现，其它单据看着正常（极难自查）。
 *   反向的错（max > 列容量）更糟：写到列容量之上会保存失败/截断。
 *
 * 【口径】`paperFieldCaps.fixture.json` = 生产库（HSDZ_MES）2026-11-24 实测的
 *   `sys.columns.max_length/2`（nvarchar 字符数），按「面板 → 字段 label → 物理列 + 容量」登记。
 *   本测试把它与 docSheetConfigs 里的 `max` 逐条比对，**必须完全相等**。
 *
 * 【怎么维护】库列变了（ALTER COLUMN 加宽/收窄）⇒ 同步改 fixture 与对应配置的 max，
 *   两边一起提交；只改一边测试就会红，这正是想要的效果。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as cfgMod from './docSheetConfigs.js'

const fixture = JSON.parse(readFileSync(new URL('./paperFieldCaps.fixture.json', import.meta.url), 'utf8'))

/** 配置对象名 → 面板码（与扫描脚本口径一致） */
function panelOf(cfgName) {
  if (cfgName === 'approvalSheetCfg') return 'RD_APPROVAL'
  if (cfgName === 'planSheetCfg') return 'RD_PLAN'
  if (cfgName.startsWith('qcSheetCfgs.')) return cfgName.split('.')[1]
  return cfgName
}

/** 收集一份纸面配置里所有带 max 的字段（行 / subs / phases / info / remark） */
function collect(cfg) {
  const keys = []
  for (const r of (cfg.rows || [])) {
    if (r.key && r.max !== undefined) keys.push([r.key, r.max])
    for (const s of (r.subs || [])) if (s.key && s.max !== undefined) keys.push([s.key, s.max])
    for (const p of (r.phases || [])) if (p.key && p.max !== undefined) keys.push([p.key, p.max])
  }
  for (const i of (cfg.info || [])) if (i.key && i.max !== undefined) keys.push([i.key, i.max])
  if (cfg.remark && cfg.remark.max !== undefined) keys.push(['备注', cfg.remark.max])
  return keys
}

/** 枚举所有纸面配置：{ 配置名: cfg } */
function allCfgs() {
  const out = {}
  for (const [name, val] of Object.entries(cfgMod)) {
    if (name === 'fixedSheetWidth' || name === 'docnoLabel') continue
    if (!val || typeof val !== 'object') continue
    if (Array.isArray(val.rows)) { out[name] = val; continue }
    for (const [k, v] of Object.entries(val)) {
      if (v && typeof v === 'object' && Array.isArray(v.rows)) out[name + '.' + k] = v
    }
  }
  return out
}

test('纸面字数上限与库列容量逐条相等（小于 ⇒ 写满即锁，大于 ⇒ 保存截断）', () => {
  const bad = []
  let checked = 0
  for (const [cfgName, cfg] of Object.entries(allCfgs())) {
    const panel = panelOf(cfgName)
    const caps = fixture[panel]
    if (!caps) continue // 未登记的面板（如尚未在生产建面板的 QC_BHCP）跳过
    for (const [label, max] of collect(cfg)) {
      if (!max || max <= 0) continue // 0 = 不限（下拉/参照）
      const known = caps[label]
      if (!known) continue
      checked++
      if (max !== known.cap) bad.push(panel + '.' + label + '(' + known.col + '): 配置 max=' + max + ' ≠ 列容量 ' + known.cap)
    }
  }
  assert.ok(checked > 50, '应至少比对 50 个字段，实际 ' + checked + '（检查枚举是否失效）')
  assert.deepEqual(bad, [], '以下字段的 max 与库列容量不一致：\n' + bad.join('\n'))
})

test('反面示例：这次报障的字段必须对齐（防止回退）', () => {
  // rd_plan.测试产品打样要求 = nvarchar(500)；曾写 max:100，导致写满 100 字的单据无法继续输入
  assert.equal(fixture.RD_PLAN['测试产品打样要求'].cap, 500)
  const row = cfgMod.planSheetCfg.rows.find((r) => r.label === '测试产品打样要求')
  assert.equal(row.max, 500)
})
