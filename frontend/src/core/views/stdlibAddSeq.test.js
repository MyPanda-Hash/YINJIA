/**
 * stdlibAddSeq.test.js —— 标准库「新增条目」必须给 seq,且排在末尾
 *
 * 【实测 bug 2026-10-29(本次「工艺形态改标准库」时发现)】
 *   StdLibController.add 的 INSERT 不写 seq ⇒ 该列为 NULL;而所有读取路径都是 ORDER BY seq,
 *   SQL Server 升序把 NULL 排**最前** ⇒ 用户新加的条目直接窜到下拉第一项:
 *     asm.form 加「自动化测试形态」后实测 seq=0,候选顺序变成
 *     [自动化测试形态, 裸棒, 机器包布, 复合半成品, 成品]
 *   业务首项(每批次 / 裸棒 这类)被挤到第二位,看起来像"选项被改乱了"。
 *
 * 【修法】取「本库最大 seq + 10」插在末尾;空库从 10 起。
 * 这条测试钉两件事:① INSERT 必须显式写 seq 列;② 取值必须是 MAX(seq)+10(不是常量 0/1)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ctl = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/StdLibController.java', import.meta.url),
  'utf8',
)

test('标准库新增条目:INSERT 必须显式包含 seq 列', () => {
  const m = ctl.match(/@PostMapping\("\/add"\)[\s\S]*?return ApiResult\.ok\(out\);/)
  assert.ok(m, '找不到 /api/stdlib/add 的实现')
  const body = m[0]
  assert.match(body, /INSERT INTO yj_std_lib\s*\([^)]*\bseq\b[^)]*\)/, 'INSERT 列清单必须含 seq(不写就是 NULL,会排到最前)')
})

test('新增条目的 seq 取「本库最大 seq + 10」,不是常量', () => {
  const m = ctl.match(/@PostMapping\("\/add"\)[\s\S]*?return ApiResult\.ok\(out\);/)
  const body = m[0]
  assert.match(body, /ISNULL\(MAX\(seq\), 0\) \+ 10/, 'seq 必须算 MAX(seq)+10(常量会让新条目与首项并列甚至插队)')
  assert.match(body, /WHERE lib_code = \?/, 'MAX(seq) 必须按 lib_code 分组算,不能跨库取最大')
})
