import fs from 'node:fs'

/**
 * _append-first-insp-migration.mjs — 把 migrate-first-insp.sql 登记进 tools/db-migrations.txt。
 * 保持文件原样:UTF-8 无 BOM + CRLF 行尾;幂等(已登记只提示)。
 */
const FILE = 'tools/db-migrations.txt'
const NAME = 'migrate-first-insp.sql'
const BLOCK = [
  '# 首件检验单 QC_FIRST_INSP(2026-10-15 用户口径:「当前增加首件检验,实现方式参考成品检验单,',
  '#   首件检验的数据来源于当前生产工单的单据当前批次第一次报工产生,检验方式参考成型工艺清单内的',
  '#   检验要求进行编写」)。',
  '#   本脚本:① 新表 qc_first_insp_head(33 列,列集照 qc_asm_insp_head + 工艺清单单号)/',
  '#     qc_first_insp_detail(24 列,取成品检验单的检验项目区,不含出货功能性测试专列)+ 3 索引;',
  '#   ② 面板 QC_FIRST_INSP(前缀 SJ,模块组 生产制造)+ 头 25 字段/明细 15 字段;',
  '#   ③ 7 角色授权行;④ 面板与 6 个新字段 en 译名;⑤ 表级 + 12 条列级中文注明;⑥ 自检。',
  '#   配套代码:ButtonService.firstInspGenerate(本工单行本批次第一张报工审核 ⇒ 出草稿 + 按《成型工艺',
  '#     清单》RD_MOLD_PROC 的检验要求预铺 5 个检验项目)/ FirstInspItems(取数 + 拼接,与按钮共用)/',
  '#     QcFirstInspController(取成型工艺清单)/ PanelConfigService(按钮下发)/ 前端菜单与带入分支。',
  '#   幂等;两账套均执行。',
  NAME,
  '',
].join('\r\n')

const txt = fs.readFileSync(FILE, 'utf8')
if (txt.includes(NAME)) {
  console.log(`SKIP: ${NAME} 已在清单里`)
} else {
  const body = txt.endsWith('\r\n') ? txt : txt.replace(/\n?$/, '\r\n')
  fs.writeFileSync(FILE, body + BLOCK, 'utf8')
  console.log(`OK: 已登记 ${NAME}`)
}
