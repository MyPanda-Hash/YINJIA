import fs from 'node:fs'

/**
 * _append-migration.mjs — 把新迁移登记进 tools/db-migrations.txt(清单是唯一权威)。
 * 保持文件原样:UTF-8 无 BOM + CRLF 行尾(实测 3173 处 CRLF、0 处裸 LF)。
 * 幂等:文件名已在清单里就只打印提示。
 */
const FILE = 'tools/db-migrations.txt'
const NAME = 'migrate-qc-proc-insp-col-count-20261017.sql'
const BLOCK = [
  '# 制程检验单纸张横表改「图2 分组横表 + 固定列 + 表头『列数』动态列」(面板 QC_PROC_INSP)。',
  '#   用户口径(2026-10-17):「仿照当前研发处的功能性滤效完成对这个制程检验单的实现能自定义增加表格列,',
  '#     然后针对当前制程检验表增加几个固定列,仿照图2的形式实现」;拍板:①改面板纸张表 ②固定列 = 外观组的',
  '#     端盖两头/管身两侧 ③加列仿功能性滤效 —— 表头一个「列数」字段 + 表格外 −/＋ 控件。',
  '#   本脚本:qc_proc_insp_head +1 `列数` int(空=没设过,界面按 min=1 渲染,点 −/＋ 才落库)+ 列级中文注明',
  '#     + yj_field 登记(place=header,hidden=1/visible=1:不进抬头格子,值照存照取,照 检验时间 口径)',
  '#     + 10 语言译名。**刻意不回填**(空 = 老行为:按各表区已有检验项目列数渲染,绝不藏数据)。',
  '#   配套代码:core/sheet/procInspCols.js(列模型纯函数 + 单测)+ core/qc/QcProcInspSheet.vue(新版式)。',
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
