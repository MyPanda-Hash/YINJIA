/**
 * _en-i18n-rename.mjs — 一次性:把 en.js 里「制程检验单/制程检验记录表」相关词条改为新名。
 * 只改 en.js(其它 9 个语言包沿用历史口径:缺键由 tt() 的机翻兜底,与 2026-10-20 IOT设备配置改名同口径)。
 * 每条替换都断言「命中且只命中一次」,任何一条对不上直接抛错不动文件。
 */
import fs from 'node:fs'

const FILE = 'frontend/src/i18n/locales/en.js'
let s = fs.readFileSync(FILE, 'utf8')

/** [旧片段, 新片段] —— 逐条精确匹配(include 整行键值对,避免误伤注释) */
const RULES = [
  // ① 早期重复定义块(147-150)
  ['    "生成制程检验单失败": "Failed to create the process inspection sheet",',
    '    "生成出货检验单功能失败": "Failed to create the outgoing functional inspection sheet",'],
  ['    "未生成制程检验单": "No process inspection sheet was created",',
    '    "未生成出货检验单功能": "No outgoing functional inspection sheet was created",'],
  ['    "该工单行已有制程检验单": "This work-order line already has a process inspection sheet",',
    '    "该工单行已有出货检验单功能": "This work-order line already has an outgoing functional inspection sheet",'],
  ['    "已生成制程检验单": "Process inspection sheet created",',
    '    "已生成出货检验单功能": "Outgoing functional inspection sheet created",'],

  // ② 「选生产工单」长句(153)
  ['    "选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。": "Pick a production work-order line (work order no. + line no. uniquely identify it) to create a process inspection draft; lines that already have a sheet are marked, re-picking will not create a duplicate.",',
    '    "选择一条生产工单行（工单号 + 工单行号唯一确定）生成出货检验单功能草稿；已建单的行会标出来，重复选择不会重复建单。": "Pick a production work-order line (work order no. + line no. uniquely identify it) to create an outgoing functional inspection sheet draft; lines that already have a sheet are marked, re-picking will not create a duplicate.",'],

  // ③ 工单追溯弹窗·质检段说明(675)
  ["    '成型出首件检验单与制程检验单，组装出组装成品检验单；切炭/混料/装箱不出检验单': 'Molding produces the first-article and in-process inspection sheets; assembly produces the finished-goods inspection sheet; cutting, mixing and packing produce none',",
    "    '成型出首件检验单与出货检验单功能，组装出组装成品检验单；切炭/混料/装箱不出检验单': 'Molding produces the first-article and outgoing functional inspection sheets; assembly produces the finished-goods inspection sheet; cutting, mixing and packing produce none',"],

  // ④ 检验项目/检验方案弹窗·适用单据说明(745)
  ["    '方案按「适用单据」分套：首件检验单 / 制程检验单 / 组装成品检验单各看自己适用的方案；勾「显示全部单据的方案」可维护所有方案（未填适用单据的旧方案也只在全部里显示）。': 'Plans are grouped by \"Applicable Document\": the first-article, in-process and assembly finished-goods sheets each see only the plans that apply to them. Tick \"Show plans for all documents\" to maintain every plan (legacy plans without an applicable document also appear only there).',",
    "    '方案按「适用单据」分套：首件检验单 / 出货检验单功能 / 组装成品检验单各看自己适用的方案；勾「显示全部单据的方案」可维护所有方案（未填适用单据的旧方案也只在全部里显示）。': 'Plans are grouped by \"Applicable Document\": the first-article, outgoing functional and assembly finished-goods sheets each see only the plans that apply to them. Tick \"Show plans for all documents\" to maintain every plan (legacy plans without an applicable document also appear only there).',"],

  // ⑤ 面板名 / 适用单据 label 的英文(749)
  ["    '制程检验单': 'In-process Inspection Sheet',",
    "    '出货检验单功能': 'Outgoing Inspection Sheet (Functional)',"],

  // ⑥ 纸面标题唯一静态词条(854)
  ["    '制程检验记录表': 'In-Process Inspection Record',",
    "    '出货检验记录表': 'Outgoing Inspection Record',"],

  // ⑦ 选生产工单(制程专用)块的后定义(819-823,生效的那一组)
  ["    '未生成制程检验单': 'No in-process inspection sheet was created',",
    "    '未生成出货检验单功能': 'No outgoing functional inspection sheet was created',"],
  ["    '该工单行已有制程检验单': 'This work order line already has an in-process inspection sheet',",
    "    '该工单行已有出货检验单功能': 'This work order line already has an outgoing functional inspection sheet',"],
  ["    '已生成制程检验单': 'In-process inspection sheet created',",
    "    '已生成出货检验单功能': 'Outgoing functional inspection sheet created',"],
  ["    '生成制程检验单失败': 'Failed to create the in-process inspection sheet',",
    "    '生成出货检验单功能失败': 'Failed to create the outgoing functional inspection sheet',"],

  // ⑧ 首页流程看板节点名(4405)
  ["    '制程检验单(成型产出)': 'Process inspection (moulding output)',",
    "    '出货检验单功能(成型产出)': 'Outgoing functional inspection (moulding output)',"],
]

let n = 0
for (const [oldStr, newStr] of RULES) {
  const hits = s.split(oldStr).length - 1
  if (hits !== 1) throw new Error(`命中数 ${hits} ≠ 1,拒绝改动:${oldStr.slice(0, 80)}`)
  s = s.replace(oldStr, newStr)
  n++
}
// 自检:en.js 里不应再有这两个旧键值对(注释里的旧词不影响)
for (const bad of ["'制程检验单': '", "'制程检验记录表': '"]) {
  if (s.includes(bad)) throw new Error(`en.js 仍含旧词条:${bad}`)
}
fs.writeFileSync(FILE, s, 'utf8')
console.log(`OK ${FILE}: ${n} 条替换完成`)
