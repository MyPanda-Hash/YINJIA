/**
 * 单据表头的「来源」提示(2026-11-11 用户口径,第二版)。
 *
 * <p>口径:「**不要做成字段,做成个按钮或者是提示就行**」—— 于是采购入库单表头不再给这两列留格子
 * (yj_field 里 `来源` / `来源单号` 两行仍是 hidden,见 tools/migrate-purchase-in-source-20261111.sql 与
 * tools/migrate-purchase-in-source-hint-20261111.sql),改在**单据号旁边**挂一条小提示:
 *
 * <pre>来源: 来料检验单 IJ-2026-10-0064</pre>
 *
 * 点它直接翻到那张来源单据(面板编码由调用方按**面板中文名**反查,见 ./panelCodeByName.js)。
 *
 * <p>提示内容来自表头两条看不见的列(`来源` = 来源面板名,`来源单号` = 那张单的编号):
 * <ul>
 *   <li>送料暂收单免检直达 → 来源 = 送料暂收单 / SL-…</li>
 *   <li>来料检验单审核入库 → 来源 = 来料检验单 / IJ-…</li>
 *   <li>特采单审批通过入库 → 来源 = 特采单 / TC-…</li>
 * </ul>
 * 手工新增、金蝶导入的老单没有来源链路(两列都空) ⇒ {@link sourceHintOf} 返回 null,界面不显示提示。
 *
 * <p>本文件**不 import 菜单/别名资源**(纯函数,`node --test` 直接跑);菜单那份在 ./panelCodeByName.js。
 */

/**
 * 由单据表头算出提示。
 *
 * @param {object} doc 单据表头(键是中文数据键)
 * @param {(name: string) => string} [resolvePanelCode] 面板中文名 → 面板编码(查不到给空串)
 * @returns {{type: string, docNo: string, panelCode: string, canOpen: boolean} | null}
 *   两列都空 ⇒ null(没有来源链路,不显示);`canOpen` = 有单号且能按名字反查到面板编码。
 */
export function sourceHintOf(doc, resolvePanelCode = () => '') {
  const head = doc || {}
  const type = String(head['来源'] || '').trim()
  const docNo = String(head['来源单号'] || '').trim()
  if (!type && !docNo) return null
  const panelCode = type ? String(resolvePanelCode(type) || '').trim() : ''
  return { type, docNo, panelCode, canOpen: Boolean(docNo && panelCode) }
}
