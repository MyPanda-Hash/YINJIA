/**
 * _clean-probe-residue-20260920.cjs — 清理今天探针残留(先看内容,再删)
 *
 * 来源:_walk-draft-novalidate 早期版本把 HEAD 写死成 rd_soak_head:在别的面板上
 *       "新增"已经建了单,但快照比对看的是 rd_soak_head ⇒ 判定"没有新编号" → SKIP,没清理。
 * 判定:用 FOR JSON 把整行取回来(列名不写死,避免"列名无效"假保留),除系统/审计列外
 *       业务字段全空 **且** 明细 0 行 ⇒ 探针空手建单的痕迹,可删;有任何业务内容一律保留。
 * 用法:node tools/archive/_clean-probe-residue-20260920.cjs [--apply]
 */
'use strict'
const { execFileSync } = require('node:child_process')
const APPLY = process.argv.includes('--apply')
// ⚠ sqlcmd 选项互斥:-W 与 -y/-Y 互斥、-h 与 -y 0 互斥。
//   普通小查询用 -W -h -1;要整行 FOR JSON(可能几百字符)只能用 -y 0,并自己在 Node 里
//   丢掉"列头 + 虚线"两行(拿不到 -h -1)。
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 1 << 26 }).trim()
/** 单个 JSON 值(不截断):去掉列头与分隔线 */
const jsonQ = (q) => {
  const out = execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
    '-s', '|', '-y', '0', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
  { encoding: 'utf8', maxBuffer: 1 << 26 }).split(/\r?\n/)
  return out.slice(2).join('\n').trim()
}
const lines = (q) => s(q).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

/** 系统/审计列:不算"业务内容" */
const SYS_COL = /^(id|单据编号|编号|文档编号|单据日期|创建时间|更新时间|编辑人|编辑日期|saved|备注|asp_)/i

/** 人工核对过、确认是探针空壳的额外条目(通用"全空"判定对遗留表不适用:它把
 *  fillRequiredDefaults 补的 0 与当天默认日期、以及面板自动加的占位明细行算成"内容")。
 *  条目格式 `面板|单据编号` → 证据。 */
const CONFIRMED_EMPTY = {
  'KHDD|OD-2026-09-0001':
    '2026-09-20 15:08 探针建单(order_bt/order_bs 遗留表):头行业务列全空(od_date=当天默认、je=0,无客户/存货/业务员);明细 2 行 od_xc=0/qty=0/je=0',
}

const CLIENTS = [
  ['KHDD', 'OD-2026-09-0001'],
  ['RD_FILTER_EFF', 'FE-2026-09-0009'],
  ['RD_MINERAL', 'MI-2026-09-0008'],
  ['RD_MOLD_PROC', 'MP-2026-09-0013'],
  ['RD_MOLD_PROC', 'MP-2026-09-0017'],
  ['RD_INSP_PLAN', 'IP-2026-09-0008'],
]

const nonEmptyBiz = (obj) => Object.entries(obj)
  .filter(([k]) => !SYS_COL.test(k))
  .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
  .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)

let removed = 0, kept = 0
for (const [panel, no] of CLIENTS) {
  const meta = lines(`SELECT ISNULL(head_table,'')+'|'+ISNULL(line_table,'')+'|'+ISNULL(group_col,'')+'|'+ISNULL(detail_key,'items') FROM yj_panel WHERE panel_code='${panel}'`)[0]
  const [head, line, gc] = (meta || '').split('|')
  if (!head || !gc) { console.log(`  ⊘ ${panel}/${no} 元数据缺失,跳过`); continue }
  const det = line || head.replace(/_head$/, '_detail')
  const detRows = lines(`SELECT COUNT(*) FROM ${det} WHERE ${gc}='${no}'`)[0]
  const headRows = lines(`SELECT COUNT(*) FROM ${head} WHERE ${gc}='${no}'`)[0]
  let rows = []
  try { rows = JSON.parse(jsonQ(`SELECT (SELECT * FROM ${head} WHERE ${gc}='${no}' FOR JSON PATH, INCLUDE_NULL_VALUES) AS j`)) } catch (e) { rows = [] }
  const biz = rows.flatMap(nonEmptyBiz)
  const confirmed = CONFIRMED_EMPTY[`${panel}|${no}`]
  const empty = (detRows === '0' && biz.length === 0) || !!confirmed
  console.log(`  ${empty ? '可删' : '保留'} ${panel}/${no}: 头行=${headRows} 明细行=${detRows} 业务内容=${biz.length ? biz.slice(0, 4).join(', ') : '(全空)'}${confirmed ? ' [人工确认:' + confirmed.slice(0, 60) + '…]' : ''}`)
  if (!empty) { kept++; continue }
  if (APPLY) {
    s(`DELETE FROM yj_doc_status WHERE panel_code='${panel}' AND doc_no='${no}';
       DELETE FROM ${det} WHERE ${gc}='${no}';
       DELETE FROM ${head} WHERE ${gc}='${no}';`)
    removed++
    console.log('       → 已删除')
  }
}
console.log('')
console.log(APPLY ? `✓ 已清理 ${removed} 张,保留 ${kept} 张` : `(预览)可清理 ${CLIENTS.length - kept} 张 —— 加 --apply 执行`)
