/**
 * _append-manu-order-panels-version-row.mjs — 给《数据库表清单》补 v3.37 维护记录(2026-10-17)。
 * ⚠ 本文档是**生成物**(gen-db-catalog.cjs),整份重生成会用脚本内硬编码的 v1.x 记录覆盖 §五;
 *   故按 v3.31/v3.33 的先例**最小插入**一行,不重生成(§5.5 C6:PS 读中文文本不可靠,用 Node 字节级处理)。
 */
import fs from 'node:fs'

const FILE = 'docs/development/数据库表清单.md'
const ROW = '| v3.37 | 2026-10-17 | **下架「生产工单明细表 MANU_ORDER_DETAIL / 生产工单统计表 MANU_ORDER_STATS」2 张报表面板(含 2 个视图)** —— 用户口径「完成上面的任务后检查当前生产工单明细标和生产工单统计表,查看当前这两个表是否没有作用,不存在作用的话删除掉就可以,帮我查看一下。」。**四条取证(2026-10-17 实测,全部落在正式库 HSDZ_MES)**:① **数据面**:两者是 `flat` 报表面板,载体视图 `v_manu_order_detail`(70 列)/`v_manu_order_stats`(11 列)读的是经典遗留那对表 `bd_manu_order` + `bl_manu_order` —— 而正式库这两张表 **0 行**、两视图因此 **0 行** ⇒ **打开就是空表**;真实生产工单走 `plang`(429 行)+ 订单结转 + 自建工单列表页,与这对遗留表无关(结论早在《MES与WMS流程梳理》§B 写明"bd_manu_order 0 行")。测试库视图有 21/11 行,是快照遗留的演示数据。② **使用面**:`yj_usage_log` 全库 7633 行(测试库 3704 行)里 panel_name 精确匹配这两个面板名 = **0 行**,放宽到「%明细表%/%统计表%」也 = **0 行** ⇒ 这一类报表面板整体从未被打开过(同一日志「生产工单」有 51 行,说明日志覆盖到生产域)。③ **代码面**:`backend/src/main/java` 全仓 grep 这两个面板码与视图名 = **0 处**(面板元数据驱动,无专属 handler)。④ **依赖面**:`sys.sql_expression_dependencies` 里引用这两个视图的主体 = 0;无外键;无报表模板;`yj_attachment`/`yj_doc_status`/`yj_form_approval`/`report_column_settings`/`yj_plan_term`/`yj_doc_annotation`/`yj_doc_modify_log`/`yj_ext_bind_log` 对这 2 个 panel_code 命中 **0 行**。**删了什么**:视图 2 + `yj_panel` 2 + `yj_field` **34** + `yj_role_panel` **6** + `yj_translation`(面板名,9 语言 ×2)**18**(`migrate-drop-manu-order-report-panels-20261017.sql`,已登记迁移链)。⚠ **一张物理表都没动** —— `bd_manu_order`/`bl_manu_order` 仍在册(被 `MANU_ORDER` 面板的 ManuCloseHandler/ManuFirstArticleHandler/ManuPurchaseReqHandler/ManuSplitHandler 引用),本批只是把两个读它们的**视图**删掉;被删的两个视图**未**登记在 `db-inuse-tables.txt`(该台账登记的是**表**),故台账不动。`yj_usage_log` 审计流水与 `s_allno` 发号痕迹也保留。**配套前端**:`menus.js` 摘掉生产计划组两项 + `menus.test.js` 期望数组同步(并新增"下架后不该再出现在菜单树里"断言)+ `BusinessOverview.vue` 生产制造「报表」清单摘两条 + 10 个语言包删这 2 条已无调用点的菜单译名(共 20 行,`_i18n-drop-manu-order-panels.mjs`)。**回退抓手** `tools/archive/_manu-order-report-panels-20261017/{restore-prod,restore-test}.sql`(由 `_gen-manu-order-panels-restore.mjs` 连库现读生成:视图定义取自 `sys.sql_modules`、元数据逐列取值,含自增列 `IDENTITY_INSERT` 原值回插,共 60 行 INSERT,逐条幂等)。⚠ 两账套均执行到「[OK] 12 batches」,自检(视图/面板/字段/授权/译名**全 0** 且两张物理表仍在)通过;**本文档 §附录 A 视图清单 106→104、覆盖范围 97→95** |'

const s = fs.readFileSync(FILE, 'utf8')
const nl = s.includes('\r\n') ? '\r\n' : '\n'
// 锚点:最后一行 v3.x 记录(v3.36)整行之后插入
const lines = s.split(/\r?\n/)
let last = -1
for (let i = 0; i < lines.length; i++) if (/^\| v3\.\d+ \|/.test(lines[i])) last = i
if (last < 0) throw new Error('未找到 v3.x 记录行,锚点失效')
lines.splice(last + 1, 0, ROW)
fs.writeFileSync(FILE, lines.join(nl), 'utf8')
console.log(`已在第 ${last + 2} 行插入 v3.37(锚点原行 ${last + 1}: ${lines[last].slice(0, 14)}…)`)
