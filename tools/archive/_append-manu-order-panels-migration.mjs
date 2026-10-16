/**
 * _append-manu-order-panels-migration.mjs — 把「下架生产工单明细表/统计表」登记进迁移清单(2026-10-17)。
 * 清单是**唯一权威**;`Get-Content` 在 PS5.1 下按 ANSI 解码会吞换行(§5.5 C6),故用 Node 字节级追加。
 */
import fs from 'node:fs'

const FILE = 'tools/db-migrations.txt'
const lines = [
  '',
  '# —— 2026-10-17 下架「生产工单明细表 MANU_ORDER_DETAIL / 生产工单统计表 MANU_ORDER_STATS」2 张报表面板 ——',
  '#   用户口径:「完成上面的任务后检查当前生产工单明细标和生产工单统计表,查看当前这两个表是否没有作用,',
  '#   不存在作用的话删除掉就可以,帮我查看一下。」',
  '#   判定“没有作用”的四条取证(全部 2026-10-17 实测):',
  '#     ① 正式库 bd_manu_order / bl_manu_order 各 0 行 ⇒ 两个载体视图 v_manu_order_detail/stats 0 行',
  '#        ⇒ 打开就是空表;真实工单走 plang(429 行)+ 订单结转 + 自建工单列表页。',
  '#     ② yj_usage_log 全库 7633 行里这两个面板一次都没被打开过(放宽到「%明细表%/%统计表%」也是 0)。',
  '#     ③ 后端 backend/src/main/java 全仓 grep 这两个面板码与视图名 = 0 处(面板是元数据驱动的)。',
  '#     ④ sys.sql_expression_dependencies 里引用这两个视图的主体 = 0;无外键;无报表模板;',
  '#        yj_attachment/yj_doc_status/yj_form_approval/report_column_settings/yj_plan_term 命中 0 行。',
  '#   删:视图 2 + yj_panel 2 + yj_field 34 + yj_role_panel 6 + yj_translation(面板名)18。',
  '#   ⚠ **不动物理表** bd_manu_order/bl_manu_order(仍在册,MANU_ORDER 面板的四个处理器还在用);',
  '#     也不动 yj_usage_log 与 s_allno。回退抓手 tools/archive/_manu-order-report-panels-20261017/',
  '#     (restore-prod.sql / restore-test.sql,由 _gen-manu-order-panels-restore.mjs 连库现读生成)。',
  '#   配套前端:menus.js 摘掉两项 + menus.test.js 期望数组同步 + BusinessOverview.vue 报表清单摘两条。',
  '#   两账套均执行到「[OK] 12 batches」,自检(视图/面板/字段/授权/译名全 0 且两张物理表仍在)通过。',
  'migrate-drop-manu-order-report-panels-20261017.sql',
]

const s = fs.readFileSync(FILE, 'utf8')
const nl = s.includes('\r\n') ? '\r\n' : '\n'
fs.writeFileSync(FILE, s.replace(/\r?\n$/, '') + nl + lines.join(nl) + nl, 'utf8')
console.log(`已登记到 ${FILE}(换行=${nl === '\r\n' ? 'CRLF' : 'LF'})`)
