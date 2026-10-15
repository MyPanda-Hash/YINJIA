/**
 * invCarry.js — 明细「物料编号 ↔ 物料名称」按商品档案双向带出(纯函数,可 node --test 断言)
 *
 * 背景(2026-10-14 用户报障「输入物料编号无法自动录入对应物料名称、输入物料名称无法自动录入对应物料编号」):
 *   成型工艺清单(RD_MOLD_PROC)「成型配方」页的 物料编号 / 物料名称 是**普通文本**
 *   (查 yj_field:两行 ref_panel 均为空,没有参照可点),手输一头另一头不会动。
 *   数据源 = 商品档案 INV(yj_panel.mode=archive,line_table=bs_inv,列 `存货编码` / `存货名称` / `所属类别`)。
 *
 * 两条硬规矩:
 *   ① **只有唯一命中才带出** —— 查不到(编码还没建档)/ 查到多条(重码、重名)一律返回空串,
 *      调用方据此「保持用户输入不动、不清空、不弹错」。用户手输的编码常常还没建档,静默是对的。
 *   ② 后端 `condition` 对**普通文本**字段走的是 `LIKE %值%`(见 QueryService.appendDirectFilters:
 *      只有 dataType=参照 才等值),`存货编码`/`存货名称` 都是普通文本 ⇒ 服务端必然可能多返回
 *      (`M-001` 会命中 `XM-001`)—— 所以**判定必须在本地按 trim 后全等收紧**,不能信 totalSize。
 *
 * 2026-10-16 增补「物料种类」(用户口径:手填物料编码要带出**物料类别**和物料名称):
 *   原先只写对侧那一格 ⇒ 页 2 配方表的 物料种类 一直空着。带出规则见 pickInvKind。
 */
// ⚠ 必须相对路径带扩展名:`@/` 别名只有 Vite 认,本模块被 node --test 直接 import(invCarry.test.js)
import { carryKindOf } from '../mold/materialKinds.js'

/** 明细列 → 商品档案列(match = 拿用户输入去比的那列,out = 要带出来的那列,
 *  kind = 带出「物料种类」的档案列;没这列的面板不受影响) */
export const INV_CARRY = {
  物料编号: { match: '存货编码', out: '存货名称', kind: '所属类别' },
  物料名称: { match: '存货名称', out: '存货编码', kind: '所属类别' },
}

/** 商品档案面板编码(QueryService 按它取 bs_inv) */
export const INV_PANEL = 'INV'

const norm = (v) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * 该明细表是否启用这对列的带出。
 * @param {Array<{key:string}>|null} cols 明细表列配置
 * @returns {string[]|null} 两列都在 ⇒ ['物料编号','物料名称'];缺一列 ⇒ null(别的明细表不受影响)
 */
export function invCarryPair(cols) {
  const keys = new Set((cols || []).map((c) => c && c.key))
  return keys.has('物料编号') && keys.has('物料名称') ? ['物料编号', '物料名称'] : null
}

/**
 * 商品档案查询响应 → 档案行数组。
 * 档案面板走 QueryService.queryArchive:返回「一张虚拟单」`{list:[{detail:{items:[rows]}}]}`;
 * 这里连平表形状一起认,认不出来返回 []。
 */
export function invRowsOf(res) {
  const list = Array.isArray(res) ? res : (res && Array.isArray(res.list) ? res.list : [])
  const out = []
  for (const r of list) {
    if (!r) continue
    const items = r.detail && r.detail.items
    if (Array.isArray(items)) out.push(...items.filter(Boolean))
    else out.push(r)
  }
  return out
}

/**
 * 按用户刚填的那一头去档案里找对侧的值。
 *
 * @param {Array<object>} rows  档案行(invRowsOf 的产物)
 * @param {string} key          用户改的明细列(`物料编号` | `物料名称`)
 * @param {*} typed             用户输入的值
 * @returns {string} 唯一命中且对侧非空 ⇒ 要带出的值;否则 ''(调用方不动任何格)
 */
export function pickInvCarry(rows, key, typed) {
  const map = INV_CARRY[key]
  if (!map || !Array.isArray(rows)) return ''
  const want = norm(typed)
  if (!want) return ''
  const hits = rows.filter((r) => norm(r && r[map.match]) === want)
  if (hits.length !== 1) return ''
  return norm(hits[0][map.out])
}

/**
 * 按用户刚填的那一头,把档案里的「所属类别」取成能写进「物料种类」的词(2026-10-16 用户口径:
 *   「在成型工艺清单填写配方表的物料信息的时候,手动填写物料编码应该带出对应的物料类别以及物料名称」)。
 *
 * 与对侧格(pickInvCarry)同一套命中判据,只有一条额外规矩:
 *   · **这格已经有人手填过 ⇒ 返回 ''(不动它)** —— 档案的类别是"物料档案口径",而料位分组是
 *     工艺员的决定(比如同一支料档案写「功能料-颗粒」,工艺上想放粉料位)。人对类别的判断优先,
 *     这与配方计算弹窗的 invFillFor 是同一条口径(只补空格)。
 *   · 档案类别**不是引擎认得的词** ⇒ 也返回 ''(carryKindOf 那道闸):补进去只会让料位静默算错。
 *
 * @param {Array<object>} rows 档案行(invRowsOf 的产物)
 * @param {string} key 用户刚改的明细列(`物料编号` | `物料名称`)
 * @param {*} typed 用户输入/选中的值
 * @param {*} current 这一行「物料种类」**当前值**(非空 = 人手填的,不动)
 * @returns {string} 要写进「物料种类」的词;不写给 ''(调用方一个格都不动)
 */
export function pickInvKind(rows, key, typed, current) {
  const map = INV_CARRY[key]
  if (!map || !map.kind || !Array.isArray(rows)) return ''
  if (norm(current)) return ''
  const want = norm(typed)
  if (!want) return ''
  const hits = rows.filter((r) => norm(r && r[map.match]) === want)
  if (hits.length !== 1) return ''
  return carryKindOf(hits[0][map.kind])
}
