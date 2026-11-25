/**
 * batchStatus.js —— 采购订单表头「送料」浮层:批次行状态的显示口径(纯函数,便于 node --test 钉住)。
 *
 * 2026-11-25 客户问「这上面关联的单据不应该都能看到吗」时暴露的缺口:
 *   浮层原来只列 yj_doc_batch 里 ACTIVE/PENDING 的行,而**占用**(form_flow_link,ACTIVE)不是每条
 *   都有台账行 —— 统一生单/选单/手工建的送料暂收单走 linkBatch(batchId=null),只写占用不建台账;
 *   台账行被释放、或与单据「批次键」对不上时也被过滤。于是出现「已送 35000/35000/5000,浮层却
 *   只有 2 批且都不是那张单」——有量、没记录。
 *
 * 后端 BatchService.batches() 现在会为这类占用补一行合成记录(status='UNREGISTERED'),
 * 本函数负责把它翻成界面文案。返回的是**中文键**(走 tt(),译名见 i18n/locales/*.js):
 * 中文界面直接显示原文,切 en/ja 不露中文。
 */

/** 后端批次行的状态 → 中文显示键(未知状态一律按「已释放」,不把原始英文码漏到界面) */
export function batchStatusKey(status) {
  const s = String(status ?? '').trim().toUpperCase()
  if (s === 'ACTIVE') return '有效'
  if (s === 'PENDING') return '待编号'
  if (s === 'UNREGISTERED') return '未登记台账'
  return '已释放'
}

/**
 * 「去向单号」格该显示什么。
 * - 正常行:显示链路终点单号(targetFormNo);
 * - 整条链的单据(含起点)都已作废/删除:后端把 targetFormNo 置空并置 targetInvalid ⇒
 *   **回显它当初指向的哪张单**(firstTargetFormNo),否则现场连"该去哪张单上排查"都无从下手;
 * - 连首跳单号都没有:显示「已作废」占位。
 * @returns {{text:string, voided:boolean, clickable:boolean}}
 */
export function batchTargetDisplay(row) {
  const target = String(row?.targetFormNo ?? '').trim()
  const first = String(row?.firstTargetFormNo ?? '').trim()
  const invalid = row?.targetInvalid === true
  if (target && !invalid) return { text: target, voided: false, clickable: true }
  if (first) return { text: first, voided: true, clickable: false }
  return { text: '', voided: true, clickable: false }
}
