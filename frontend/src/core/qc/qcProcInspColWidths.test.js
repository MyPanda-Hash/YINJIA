/**
 * qcProcInspColWidths.test.js —— 出货检验功能记录表「检验方法比检验要求宽」钉子
 *
 * 【2026-11-17 用户口径】「把检验方法列调宽，检验要求调小」。
 *   截图实测(1562×960 视口)：检验项目 108px / **检验方法 139px** / **检验要求 322px** /
 *   每批两列各 111px。方法列比要求列窄了 20 个百分点，一段 80 字的测试步骤被压成 7~8 行。
 *
 * 【为什么这是缺陷而不是口味】两张表的列宽口径本来就该同向：
 *   导出侧 qcProcInspExport.js 的 PROC_INSP_BASE_COLS 明写 检验方法 wch:40 > 检验要求 wch:34
 *   （方法列更宽），而屏幕侧 colWidths 却是 12% vs 32% —— 同一张纸的两套口径互相矛盾。
 *
 * 【判据】
 *   ① 检验方法 的百分比必须 > 检验要求（本次失败→修复的唯一实质条件）；
 *   ② 方法列要给到 ≥18%（139px→200px 量级，肉眼可见地不那么挤）；
 *   ③ 百分比合计恒为 100（含操作列），否则表格宽度与容器对不上；
 *   ④ 每批两列仍平分余量（批次号列要放得下「标签+输入框+×」）。
 *
 * 单测跑不了布局，按仓库既有做法读源码钉住（同 docSheetFitWidth.test.js / extCols.test.js）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sheet = readFileSync(new URL('./QcProcInspSheet.vue', import.meta.url), 'utf8')

/** 从 colWidths 计算属性里取出三个基础列的百分比常量 */
function basePcts() {
  const m = sheet.match(/const colWidths = computed\(\(\) => \{[\s\S]*?\n\}\)/)
  assert.ok(m, '找不到 colWidths 计算属性')
  const body = m[0]
  const grab = (name) => {
    const r = body.match(new RegExp(`const ${name} = (\\d+)`))
    assert.ok(r, `找不到 ${name} 的数值定义`)
    return Number(r[1])
  }
  return { item: grab('itemPct'), mtd: grab('mtdPct'), req: body, reqBody: body }
}

test('① 检验方法列必须比检验要求列宽（本次报障的核心）', () => {
  const body = sheet.match(/const colWidths = computed\(\(\) => \{[\s\S]*?\n\}\)/)[0]
  const item = Number(body.match(/const itemPct = (\d+)/)[1])
  const mtd = Number(body.match(/const mtdPct = (\d+)/)[1])
  // 要求列按批次数分档，取最小档(n≤2)做对比——最宽的那档都不该超过方法列
  const reqCandidates = [...body.matchAll(/reqPct[^\n]*?(\d+)\s*:/g)].map((x) => Number(x[1]))
  const reqInline = [...body.matchAll(/n === 3 \? (\d+) : (\d+)/g)].map((x) => Number(x[1]))
  assert.ok(reqCandidates.length || reqInline.length, '找不到 reqPct 的取值')
  const maxReq = Math.max(...reqCandidates, ...reqInline)
  assert.ok(mtd > maxReq, `检验方法 ${mtd}% 必须大于检验要求最大档 ${maxReq}%（否则长文本仍被压成一行一字）`)
  assert.ok(mtd >= 18, `检验方法 ${mtd}% 太小：本次要求是「调宽」，至少要 18%`)
  assert.ok(item < mtd, `检验项目 ${item}%（短标签）不该比检验方法 ${mtd}%（长文本）宽`)
})

test('② 三个基础列 + 操作列的百分比合计为 100（表格宽才能与容器严丝合缝）', () => {
  const body = sheet.match(/const colWidths = computed\(\(\) => \{[\s\S]*?\n\}\)/)[0]
  const item = Number(body.match(/const itemPct = (\d+)/)[1])
  const mtd = Number(body.match(/const mtdPct = (\d+)/)[1])
  const op = Number(body.match(/opPct = props\.editable \? ([\d.]+)/)[1])
  // 计算那一行必须用同一个减法把要求列的余量算出来，而不是各写各的常量
  assert.match(body, /100 - itemPct - mtdPct - opPct - pairTotal/,
    '要求列百分比必须由 100 − 其余列 求出（否则合计不为 100）')
  assert.ok(item + mtd + op <= 100, '三列 + 操作列不能超过 100%')
})

test('③ 每批两列仍平分余量（批次号列要放得下标签+输入框+×）', () => {
  const body = sheet.match(/const colWidths = computed\(\(\) => \{[\s\S]*?\n\}\)/)[0]
  assert.match(body, /const pairPct = pairTotal \/ n/, '每批两列要按批次数平分余量')
  assert.match(body, /pairPct \* 0\.5/, '每个批次的两列各占一半')
  assert.match(body, /n \* 6/, '批次列要有最小值兜底（否则批次一多就被挤没）')
})
