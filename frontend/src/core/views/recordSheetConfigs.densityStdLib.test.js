import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

/**
 * 烧结工艺清单（RD_MOLD_PROC）「密度管控 · 管控要求」接入标准库（2026-11-11 用户口径）。
 *
 * 用户原话：「把烧结工艺清单面板的密度管控的管控要求字段加入标准库，可以自行维护更新」；
 * 追问「实际密度管控范围 两个区域是不变动的 还是手动输入密度值供计算」后确认：
 *   ① 管控要求 → 标准库（可挑现成的密度范围，也可手填）；
 *   ② 实际密度管控下限 / 上限 **不变动，仍手工输入** —— 计算只用这两格。
 *
 * 这些断言钉的是**纸面版式那半边**（库/元数据那半边在
 * tools/migrate-mold-density-stdlib-20261111.sql，同一支测试在下面一并核对它）：
 *   · RecordSheetPanels 的 `editable && c.type === 'select'` 分支才会渲染
 *     el-select（filterable + allow-create ⇒ 可选可手填）与「⧉ 标准库维护」入口；
 *     该分支还要求 `stdLibOf(key)` 非空 —— 即 yj_field.data_type='标准库' + dict_sql=库编码。
 *   · 反面：两个「实际密度管控…」格必须保持普通输入格，别被顺手改成下拉。
 */

const CFG_SRC = readFileSync(new URL('./recordSheetConfigs.js', import.meta.url), 'utf8')
const MIGRATION = new URL('../../../../tools/migrate-mold-density-stdlib-20261111.sql', import.meta.url)

/** 递归收集 RD_MOLD_PROC 版式里所有「格子」（sections.grid / dataTables.cols / pairs 都认） */
function cellsOf(node, out = []) {
  if (Array.isArray(node)) {
    for (const n of node) cellsOf(n, out)
    return out
  }
  if (!node || typeof node !== 'object') return out
  if ('key' in node || 'label' in node) out.push(node)
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') cellsOf(v, out)
  }
  return out
}

const cells = cellsOf(recordSheetConfigs.RD_MOLD_PROC)
const byKey = (k) => cells.filter((c) => c.key === k)

test('① 密度管控要求 = 标准库下拉格（type:select ⇒ 才有下拉 + ⧉标准库维护）', () => {
  const hit = byKey('密度管控要求')
  assert.equal(hit.length, 1, 'RD_MOLD_PROC 里应有且只有一个「密度管控要求」数据格')
  assert.equal(hit[0].type, 'select',
    '必须是 select：「标准库设置选项」在纸面上就落在这个分支（普通文本框只有 ⌄标准库 勾选，没有维护入口）')
  assert.equal(hit[0].span, 2, '版式宽度不变（原值）')
  assert.equal(hit[0].ph, '密度范围：~', '占位符不变（标准库条目照这个形状写）')
})

test('② 实际密度管控下限/上限 保持手工输入格（用户口径：两个区域不变动）', () => {
  for (const k of ['实际密度管控下限', '实际密度管控上限']) {
    const hit = byKey(k)
    assert.equal(hit.length, 1, `${k} 应有一个数据格`)
    assert.equal(hit[0].type, undefined, `${k} 不许改成下拉 —— 它是手填的密度值，计算直接吃这两格`)
    assert.equal(hit[0].stdLib, undefined, `${k} 不许挂标准库`)
    assert.equal(hit[0].span, 4, '版式宽度不变（原值）')
  }
})

test('③ 迁移脚本只绑 密度管控要求 一格，且种子幂等、不碰那两个手填格', () => {
  const sql = readFileSync(MIGRATION, 'utf8')
  assert.match(sql, /data_type\s*=\s*N'标准库'/, '要把 data_type 改成 标准库')
  assert.match(sql, /dict_sql\s*=\s*N'mold\.density'/, '库编码必须是 mold.density')
  assert.match(sql, /col_name\s*=\s*N'密度管控要求'/, '只绑这一格')
  assert.doesNotMatch(sql, /col_name\s*=\s*N'实际密度管控(下限|上限)'/,
    '两个「实际密度管控」格不许出现在迁移里（它们保持手填）')
  assert.match(sql, /WHERE NOT EXISTS \(SELECT 1 FROM yj_std_lib/,
    '种子必须带 NOT EXISTS 判重，重复执行只能新增 0 条')
})

test('④ 纸面配置里 密度管控要求 仍挂在「密度管控」块的第 2 行（版式没被搬动）', () => {
  const src = CFG_SRC
  const labelIdx = src.indexOf("{ label: '密度管控', rowspan: 2 }")
  const keyIdx = src.indexOf("{ key: '密度管控要求'")
  assert.ok(labelIdx > 0, '应有「密度管控」块名标签格（rowspan 2）')
  assert.ok(keyIdx > labelIdx, '「密度管控要求」数据格应在块名标签格之后')
  const between = src.slice(labelIdx, keyIdx)
  assert.match(between, /label: '管控要求', span: 2/, '「管控要求」标签格仍在（与值格同列对齐）')
  assert.equal((between.match(/\{ grid: \[/g) || []).length, 1,
    '标签行与值行之间只隔一次换行 —— 值格不许被搬出「密度管控」块')
})
