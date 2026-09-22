/* =============================================================================
   特采申请单(QC_TC)整体下线 —— 面板 + 字段 + 物理表 全删(2026-09-22)

   用户口径(2026-09-22):「有两个特采单,删除那个质量单据的特采申请单」。
     · 保留:品质管理 > 来料品质 >「特采单」(QC_TC_IN,独立面板 / 独立表 qc_tc_in /
       前缀 TCI)。来料特采走这条,与 YJ-QR-60 同一张版式。
     · 删除:品质管理 > 质量单据 >「特采申请单」(QC_TC,前缀 TC)及其表 qc_tc。

   删除范围(删前实测,见 tools/archive/_q-tc-predrop.sql 与 _q-tc-sweep.sql):
     1) 业务表 qc_tc(0 行)、qc_tc_detail(0 行)—— 无视图/外键依赖,可直接 DROP
     2) yj_panel 1 行、yj_field 23 行(全库带 panel_code 的表扫一遍,只有这两张有行)
     3) s_allno 号池 lb='TC' 残留(当前 0 行;防御性清理 —— 面板已删,该前缀不再发号)
     4) 状态/链路/权限/附件/审批/报表设置等挂账行(当前全 0,防御性清理)

   刻意不动(重要):
     · yj_translation(scope='panel', ref_key=N'特采申请单') —— 这条面板译名被 QC_TC_IN 复用
       (migrate-qc-tc-in.sql 建面板时 SELECT 它的 text 作为 panel_name_en),
       删掉会让新建库的 QC_TC_IN 英文名变 NULL。保留。
     · 前端 i18n 的 biz 词条「特采申请单」—— 与面板译名同理,不动。

   配套改动(同一提交,缺一不可):
     · tools/migrate-qc-8sheets.sql:移除其中 QC_TC 的建表 / 面板行 / 23 字段行。
       该脚本每条语句都有 IF 守卫、重跑无副作用,但若不移除,未来它一旦重跑就会把
       已删的 QC_TC 复活成僵尸面板(菜单与版式都已不在,只剩库里的孤儿行)。
     · frontend/src/business/menus.js:摘掉 质量单据 组的「特采申请单」菜单行。
     · frontend/src/core/views/docSheetConfigs.js:移除 qcSheetCfgs.QC_TC 版式键。
     · tools/migrate-qc-tc-final-result.sql 保留为历史记录:它此后 UPDATE 命中 0 行,
       幂等无害,不再单独维护。

   幂等:可重复执行(全部 IF EXISTS / WHERE 判存 + 末尾自检)。
   运行:java -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-tc-drop.sql
   ============================================================================= */
SET NOCOUNT ON;
GO

-- ══════════ 1. 业务表(先明细后头表) ══════════
IF OBJECT_ID('qc_tc_detail') IS NOT NULL DROP TABLE qc_tc_detail;
IF OBJECT_ID('qc_tc') IS NOT NULL DROP TABLE qc_tc;
GO

-- ══════════ 2. 面板 / 字段注册 ══════════
DELETE FROM yj_field WHERE panel_code = 'QC_TC';
DELETE FROM yj_panel WHERE panel_code = 'QC_TC';
GO

-- ══════════ 3. 号池残留(面板已删,前缀 TC 不再发号) ══════════
-- s_allno 是发号留痕表:只有真起过 TC 单据才会有行,实测 0 行(该面板从未使用)。
DELETE FROM s_allno WHERE lb = 'TC';
GO

-- ══════════ 4. 挂账行(防御性;实测全 0) ══════════
-- 注:yj_translation 的「特采申请单」面板译名刻意保留(QC_TC_IN 复用),见文件头。
DELETE FROM yj_doc_status WHERE panel_code = 'QC_TC';
DELETE FROM form_flow_link WHERE source_panel_code = 'QC_TC' OR target_panel_code = 'QC_TC';
DELETE FROM yj_role_panel WHERE panel_code = 'QC_TC';
DELETE FROM yj_attachment WHERE panel_code = 'QC_TC';
DELETE FROM yj_form_approval WHERE panel_code = 'QC_TC';
DELETE FROM yj_doc_modify_log WHERE panel_code = 'QC_TC';
DELETE FROM yj_plan_term WHERE panel_code = 'QC_TC';
DELETE FROM yj_report_template WHERE panel_code = 'QC_TC';
DELETE FROM report_column_settings WHERE panel_code = 'QC_TC';
GO

-- ══════════ 5. 自检(应全为 NULL / 0;最后一项应为 1=共用译名已保留) ══════════
SELECT
  OBJECT_ID('qc_tc') AS qc_tc表, OBJECT_ID('qc_tc_detail') AS qc_tc_detail表,
  (SELECT COUNT(*) FROM yj_panel WHERE panel_code = 'QC_TC') AS 面板行,
  (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'QC_TC') AS 字段行,
  (SELECT COUNT(*) FROM s_allno WHERE lb = 'TC') AS 号池TC行,
  (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'QC_TC') AS 状态行,
  (SELECT COUNT(*) FROM yj_translation WHERE scope = 'panel' AND ref_key = N'特采申请单') AS 保留的共用译名;
PRINT N'migrate-qc-tc-drop 完成:质量单据·特采申请单(QC_TC)面板与表已删;共用译名保留(QC_TC_IN 用)';
GO
