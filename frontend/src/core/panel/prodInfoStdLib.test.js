/**
 * 产品信息表的「产品管控等级 / 产品形态」必须只出现字典内的合法值。
 *
 * 用户报障（2026-11-17）：「产品管控等级是乱编的吗？单据里面没有填写这些数据」。
 * 查实是**两个脚本叠加**写进去的非法值「家用终端」：
 *   ① migrate-prod-info-seed.sql 把 N'家用终端'（应用场景语义）写进了 [产品分类]；
 *   ② migrate-rd-2026-design.sql 的「历史值搬迁」无条件
 *      `UPDATE ... SET [产品管控等级] = [产品分类]` ⇒ 「家用终端」被复制成管控等级，
 *      而字典 prod.ctrl_level 只有 重点产品 / KPC产品 / 其他。
 * 按用户口径 A（只修脚本、不动已入库数据），这里钉住"脚本不许再写出非法值"。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const seed = readFileSync(new URL('../../../../tools/migrate-prod-info-seed.sql', import.meta.url), 'utf8')
const design = readFileSync(new URL('../../../../tools/migrate-rd-2026-design.sql', import.meta.url), 'utf8')

test('种子脚本不得把场景值写进 产品分类 / 产品形态', () => {
  // VALUES 里出现的「家用终端」「滤芯」都已订正为 NULL
  const valuesPart = seed.slice(seed.indexOf('FROM (VALUES'))
  assert.ok(!valuesPart.includes("N'家用终端'"), '种子 VALUES 里不该再有「家用终端」')
  // 产品形态 那一列（下单数量之后、责任人之前）必须是 NULL，不是 '滤芯'
  assert.ok(!/N'1',\s*NULL,\s*N'滤芯'/.test(valuesPart),
    '产品形态不得再写 N\'滤芯\'（prod.form 只有 包布/套网/打端盖/套PP棉）')
})

test('历史值搬迁只搬管控字典内的合法值，不得无条件整列复制', () => {
  // 旧写法（错的）：SET [产品管控等级] = [产品分类] WHERE ... 无值域限制
  const at = design.indexOf('SET [产品管控等级] = [产品分类]')
  assert.ok(at > 0, '找不到搬迁语句')
  const stmt = design.slice(at, design.indexOf(';', at) + 1)
  assert.match(stmt, /IN \(N'重点产品', N'KPC产品', N'其他'\)/,
    '必须加白名单：只搬确实是管控语义的值')
  assert.match(design, /IN \(N'重点产品', N'KPC产品', N'其他'\)/,
    '白名单必须与字典 prod.ctrl_level 一致')
})

test('脚本文件不得带 UTF-8 BOM（sqlcmd/SqlRunner 会报 Incorrect syntax near ﻿）', () => {
  for (const [name, txt] of [['migrate-prod-info-seed.sql', seed], ['migrate-rd-2026-design.sql', design]]) {
    assert.notEqual(txt.charCodeAt(0), 0xFEFF, `${name} 带 BOM，执行会报语法错`)
  }
})
