/**
 * prodDocListRoot.test.js —— 产品文件列表必须以「产品信息表」为根（2026-10-30）
 *
 * 【需求来源·用户原文】
 *   「本地的这个产品文件列表也是和产品信息表关联的，没有对应的产品信息表就不显示了，
 *    现在我只有一个产品信息表，但是有三个文件列表数据」
 *
 * 【根因】矩阵行直接来自 `rd_dev_task`（下发记录）按产品编号 GROUP BY，
 *   **完全不看产品信息表**。于是只要历史上给某个产品编号下发过文件，即使那个产品的
 *   产品信息表从来没建过 / 已经被删掉作废，它照样在列表里占一行。
 *   实测本地：rd_dev_task 有 3 个产品编号（YJ-CB-2026-001 / YJ-FINAL-01 / YJ-VERIFY-1029），
 *   而 rd_prod_info_head 只有 YJ-CB-2026-001 有对应行（另一张 PI-2026-10-0025 产品编号是空的）。
 *
 * 【为什么用源码断言】判据是一条 SQL 里的一处 WHERE/EXISTS，mount 端到端成本过高；
 *   这类回归的典型形态就是「有人把关联条件删了/换成只查 rd_dev_task」。
 *   真实数据的取数结果由活体验证覆盖（见提交说明里的 prodDocList 前后行数）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../../../../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

const devTask = read('backend/src/main/java/com/yinjia/mes/service/DevTaskService.java')

/** board() 方法体（找不到返回空串，让断言失败而不是抛错） */
function boardBody(src) {
  const i = src.indexOf('public List<Map<String, Object>> board()')
  if (i < 0) return ''
  const j = src.indexOf('return out;', i)
  return src.slice(i, j > i ? j : i + 4000)
}

test('① 产品文件列表的行必须以产品信息表为根（没有产品信息表就不显示）', () => {
  const body = boardBody(devTask)
  assert.ok(body, 'board() 要能找到')
  assert.match(
    body,
    /rd_prod_info_head/,
    'board() 只按 rd_dev_task 的产品编号出行，没跟产品信息表关联 ⇒ 没有产品信息表的产品也会占一行',
  )
  assert.match(body, /EXISTS|JOIN/i, '必须是关联过滤，不是把两张表各行其是地读出来')
})

test('② 作废/删除的产品信息表不算数（两侧判活口径同全库）', () => {
  const body = boardBody(devTask)
  assert.match(body, /asp_cancel/, '产品信息表侧也要排软删行')
  assert.match(
    body,
    /yj_doc_status/,
    '产品信息表作废/删除只写 yj_doc_status.canceled=\'Y\' 不动 asp_cancel ⇒ 只查 asp_cancel 会漏',
  )
  assert.match(body, /RD_PROD_INFO/, '状态行要按面板 RD_PROD_INFO 定位')
})

test('③ 产品编号为空的不得互相匹配（空 = 空 会造成误关联）', () => {
  const body = boardBody(devTask)
  // 关联条件里两边的产品编号都要判非空
  assert.match(
    body,
    /ISNULL\([^)]*\[?产品编号\]?,?\s*N?'\''\)\s*<>\s*N?''|LTRIM\(RTRIM\(ISNULL\(/,
    '产品编号空值必须排除，否则「空=空」会把没有编号的产品信息表匹配到所有缺编号的下发行',
  )
})