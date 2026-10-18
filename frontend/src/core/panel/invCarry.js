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
 *
 * 2026-10-16 修复「档案明细键写死 detail.items」(上线后按种类筛出来恒 0 个候选的真正根因):
 *   见 invRowsOf 注释 —— 本模块的桩数据形状骗过了单测,判据改走 core/panel/detailRows.js。
 */
// ⚠ 必须相对路径带扩展名:`@/` 别名只有 Vite 认,本模块被 node --test 直接 import(invCarry.test.js)
import { carryKindOf } from '../mold/materialKinds.js'
// 明细键的唯一判据(INV 是 detail.inv,不是 detail.items)—— 见 invRowsOf 注释
import { detailKeyOf } from './detailRows.js'

/** 明细列 → 商品档案列(match = 拿用户输入去比的那列,out = 要带出来的那列,
 *  kind = 带出「物料种类」的档案列;没这列的面板不受影响) */
export const INV_CARRY = {
  物料编号: { match: '存货编码', out: '存货名称', kind: '所属类别' },
  物料名称: { match: '存货名称', out: '存货编码', kind: '所属类别' },
}

/** 商品档案面板编码(QueryService 按它取 bs_inv) */
export const INV_PANEL = 'INV'

/**
 * 「物料编号」边填边模糊筛的请求体(2026-10-16 用户口径:「输入 Y 或者 003 时模糊搜索到含这些
 * 数字字母的」)。**空关键字返回 null** —— 调用方据此连请求都不发,这是结构上的闸门:
 *
 * 服务端 `keyword` 走的是「本面板所有字段 LIKE %kw%」的 OR(QueryService.appendDirectFilters),
 * 空 keyword 等于**不过滤**:档案分支根本不吃 pageSize(它必须全量返回,见 queryArchive 注释),
 * 于是一次空关键字查询 = 把整份 bs_inv(生产上几千行 × 113 列)拉回来。所以宁可一个候选都不给。
 *
 * pageSize 只是表明意图(档案分支忽略它),前端再把候选封顶 OPTION_CAP=50 项。
 *
 * @param {*} keyword 用户敲进下拉框的关键字
 * @returns {Record<string, any>|null} 请求体;关键字为空/纯空格 ⇒ null(不许发)
 */
export function invSearchRequest(keyword) {
  const kw = norm(keyword)
  if (!kw) return null
  return { panelCode: INV_PANEL, keyword: kw, condition: {}, pageNo: 1, pageSize: 50 }
}

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
 * 档案面板走 QueryService.queryArchive:返回「一张虚拟单」`{list:[{detail:<detail_key>:[rows]}]}`;
 * 这里连平表形状一起认,认不出来返回 []。
 *
 * ⚠ 明细键**不是**恒为 `items`(2026-10-16 用户报障的真实根因):`QueryService.queryArchive` 写的是
 *   `detail.<PanelDef.tabKey()>`,而档案面板的 tabKey = `yj_panel.detail_key` =
 *   `LOWER(panel_code)`(`migrate-arch-single-doc.sql`)⇒ INV 是 `detail.inv`、EMP 是 `detail.emp`。
 *   本文件原先写死 `detail.items` ⇒ 商品档案 3898 行**一行都拍不出来**(只剩那张虚拟单被当成一行),
 *   界面表现 = 配方计算弹窗按「物料种类」收窄后「没有候选」、页 2 配方表 物料编号 模糊筛零候选;
 *   而单测桩数据恰好写成 `detail.items` ⇒ 本地测试全绿也照样漏(实测 `detail.inv[3898]`,旧逻辑拍平 1 行)。
 *   故改走**唯一判据** `core/panel/detailRows.js`(优先 items,否则取 detail 里第一个数组值)。
 *
 * 形状口径:
 *   · detail 里存着数组(不论键名) ⇒ 用它,**哪怕它是空数组**(单据本身不是行,不能当兜底);
 *   · 没有 detail/没有任何数组(detail 缺失、平表虚拟单、裸行数组) ⇒ 那个对象自己就是一行。
 *
 * @param {*} res 接口响应体(或 res.data)
 * @param {string} [fallbackKey] detail 结构识别不出时按哪个键找(商品档案 = 'inv')
 */
export function invRowsOf(res, fallbackKey = 'inv') {
  const list = Array.isArray(res) ? res : (res && Array.isArray(res.list) ? res.list : [])
  const out = []
  for (const r of list) {
    if (!r) continue
    const key = detailKeyOf(r, fallbackKey)
    const rows = r.detail && Array.isArray(r.detail[key]) ? r.detail[key] : null
    if (rows) out.push(...rows.filter(Boolean))
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
