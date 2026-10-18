/* ============================================================================
   cleanup-rd-testledger-20261016.sql — 测试账套「研发区」一次性清库

   用户口径(2026-10-16):「把这些测试的不要的数据清掉」→ 选定「全清 25 张」。
   这些单据只存在于**测试账套** HSDZ_MES_TEST(正式库 HSDZ_MES 里研发单据实测 0 张)。

   ⚠⚠ 两条红线:
     ① 只允许在 HSDZ_MES_TEST 执行 —— 脚本自带硬闸门(库名不符直接 RAISERROR 退出),防手滑。
     ② **禁止登记进 tools/db-migrations.txt** —— 登记 = DbSync 每次同步都对正式库重放一次,
        与 migrate-rd-cleanup.sql / _doc_part3_cleanup.sql / cleanup-base-panels.sql 同款先例
        (db-migrations.txt 第 171 行有红线注释)。

   清什么(清前实测):研发单据 25 张 —— 立项申请 LXA-*(4) / 产品信息表 PI-*(7) / 实施计划 LXB-*(1) /
     规格书 SD-*(3) / 成型工艺清单 MP-*(6) / 出货检验计划 IP-*(1) / 产品变更 CHG-*(1) /
     项目进度(1) / 数据记录 PH-*(1)、FE-*(1);
     以及它们挂靠的:单据状态 25 / 审批痕迹 33 / 修改记录 4 / 批注 10 / 附件 1 / 产品开发任务 8 / 使用日志。
   不清什么(有意保留):
     · rd_sinter_tolerance(60 行 = 烧结公差**标准库**,不是单据数据)
     · rd_dev_task_bak_20261013(历史备份表)、rd_sample_no_*(已下架面板的留档表)
     · 号池 s_allno(**不归零**:新单号继续往下走;要归零参考 migrate-rd-cleanup.sql)
     · 元数据(yj_panel / yj_field / yj_role_panel)与基础档案

   幂等:整段包在事务里;末尾自检「研发区残留 = 0」,不为 0 就 ROLLBACK + RAISERROR。
   执行:cd tools
     $env:YINJIA_SQL_PASS="..."; $env:YINJIA_SQL_DB="HSDZ_MES_TEST"
     java -cp lib\mssql-jdbc.jar DbSync.java run cleanup-rd-testledger-20261016.sql
   ============================================================================ */
SET NOCOUNT ON;

-- ⚠ 两个本机实测踩过的坑(别"顺手改回去"):
--   ① 比较写 != 不写 <> —— 该批次经 DbSync/JDBC 执行时含 <> 会报「在 'DB_NAME' 附近有语法错误」;
--   ② RAISERROR 的替换参数**只能给变量/常量,不能给函数调用** —— 写 RAISERROR(..., DB_NAME())
--      会同样报「在 'DB_NAME' 附近有语法错误」;所以先 DECLARE @db = DB_NAME() 再传变量。
DECLARE @db sysname = DB_NAME();
IF @db != N'HSDZ_MES_TEST'
BEGIN
    RAISERROR(N'本脚本只允许在测试账套 HSDZ_MES_TEST 执行(当前库:%s)', 16, 1, @db);
    RETURN;
END
GO

BEGIN TRANSACTION;

/* ── ① 使用日志:必须**先**按单据编号删(单据一删就查不到了) ── */
DELETE FROM yj_usage_log WHERE doc_no IN (
    SELECT [单据编号] FROM rd_approval      UNION
    SELECT [单据编号] FROM rd_plan          UNION
    SELECT [单据编号] FROM rd_progress      UNION
    SELECT [单据编号] FROM rd_prod_info_head UNION
    SELECT [单据编号] FROM rd_spec_doc_head  UNION
    SELECT [单据编号] FROM rd_mold_proc_head UNION
    SELECT [单据编号] FROM rd_asm_proc_head  UNION
    SELECT [单据编号] FROM rd_insp_plan_head UNION
    SELECT [单据编号] FROM rd_filter_eff_head UNION
    SELECT [单据编号] FROM rd_alkaline_head  UNION
    SELECT [单据编号] FROM rd_mineral_head   UNION
    SELECT [单据编号] FROM rd_antibact_head  UNION
    SELECT [单据编号] FROM rd_scale_head     UNION
    SELECT [单据编号] FROM rd_ro_protect_head UNION
    SELECT [单据编号] FROM rd_soak_head      UNION
    SELECT [单据编号] FROM rd_drop_prec_head UNION
    SELECT [单据编号] FROM rd_change_head
    UNION ALL SELECT [单据编号] FROM rd_sample_no_head
);

/* ── ② 单据状态 / 审批痕迹 / 修改记录 / 批注 / 附件 / 终止申请 / 流转链接 / 单据消息(按面板) ── */
DELETE FROM yj_attachment     WHERE panel_code LIKE N'RD%';
DELETE FROM yj_doc_annotation WHERE panel_code LIKE N'RD%';
DELETE FROM yj_doc_status     WHERE panel_code LIKE N'RD%';
DELETE FROM yj_form_approval  WHERE panel_code LIKE N'RD%';
DELETE FROM yj_doc_modify_log WHERE panel_code LIKE N'RD%';
DELETE FROM yj_plan_term      WHERE panel_code LIKE N'RD%';
-- 2026-10-16 补:研发单据消息。判据与 verify/RdAreaEmptyAudit.java ② 同源(该表列名叫 面板编码,不是 panel_code);
-- 原先漏了这张表 ⇒ 闸门会 FAIL 在这一项(实测 15 行:DEMO-CHG-001 / PI-2026-09-0084 / CHG-2026-09-0030 /
-- MP-* / AP-* / IP-* / SD-* 那批演示单发出的消息)。
DELETE FROM yj_message       WHERE 面板编码 LIKE N'RD%';
DELETE FROM form_flow_link    WHERE source_panel_code LIKE N'RD%' OR target_panel_code LIKE N'RD%';
GO

/* ── ③ 产品开发任务(rd_dev_task,按产品编号指向被删的产品信息表) ── */
DELETE FROM rd_dev_task;
GO

/* ── ④ 业务数据:行表先清,再清头表 ── */
DELETE FROM rd_approval_detail;      DELETE FROM rd_approval;
DELETE FROM rd_plan_detail;          DELETE FROM rd_plan;
DELETE FROM rd_progress_detail;      DELETE FROM rd_progress;
DELETE FROM rd_prod_info_detail;     DELETE FROM rd_prod_info_head;
DELETE FROM rd_spec_doc_detail;      DELETE FROM rd_spec_doc_head;
DELETE FROM rd_mold_proc_detail;     DELETE FROM rd_mold_proc_head;
DELETE FROM rd_asm_proc_detail;      DELETE FROM rd_asm_proc_head;
DELETE FROM rd_insp_plan_detail;     DELETE FROM rd_insp_plan_head;
DELETE FROM rd_change_detail;        DELETE FROM rd_change_head;
DELETE FROM rd_filter_eff_detail;    DELETE FROM rd_filter_eff_head;
DELETE FROM rd_alkaline_detail;      DELETE FROM rd_alkaline_head;
DELETE FROM rd_mineral_detail;       DELETE FROM rd_mineral_head;
DELETE FROM rd_antibact_detail;      DELETE FROM rd_antibact_head;
DELETE FROM rd_scale_detail;         DELETE FROM rd_scale_head;
DELETE FROM rd_ro_protect_detail;    DELETE FROM rd_ro_protect_head;
DELETE FROM rd_soak_detail;          DELETE FROM rd_soak_head;
DELETE FROM rd_drop_prec_detail;     DELETE FROM rd_drop_prec_head;
DELETE FROM rd_spike_water_detail;   DELETE FROM rd_spike_water_head;
DELETE FROM rd_dom_test_detail;      DELETE FROM rd_dom_test_head;
DELETE FROM rd_equip_use_detail;     DELETE FROM rd_equip_use_head;
DELETE FROM rd_instr_use_detail;     DELETE FROM rd_instr_use_head;
DELETE FROM rd_prod_doclist_detail;  DELETE FROM rd_prod_doclist_head;
DELETE FROM rd_spec_assign;
GO

/* ── ⑤ 自检:研发区残留必须为 0,否则整段回滚 ── */
DECLARE @left int = (
      (SELECT COUNT(*) FROM yj_doc_status     WHERE panel_code LIKE N'RD%')
    + (SELECT COUNT(*) FROM yj_form_approval  WHERE panel_code LIKE N'RD%')
    + (SELECT COUNT(*) FROM yj_doc_modify_log WHERE panel_code LIKE N'RD%')
    + (SELECT COUNT(*) FROM yj_doc_annotation WHERE panel_code LIKE N'RD%')
    + (SELECT COUNT(*) FROM yj_attachment     WHERE panel_code LIKE N'RD%')
    + (SELECT COUNT(*) FROM yj_plan_term      WHERE panel_code LIKE N'RD%')
    + (SELECT COUNT(*) FROM yj_message        WHERE 面板编码 LIKE N'RD%')
    + (SELECT COUNT(*) FROM form_flow_link    WHERE source_panel_code LIKE N'RD%' OR target_panel_code LIKE N'RD%')
    + (SELECT COUNT(*) FROM rd_dev_task)
    + (SELECT COUNT(*) FROM rd_approval)         + (SELECT COUNT(*) FROM rd_approval_detail)
    + (SELECT COUNT(*) FROM rd_plan)             + (SELECT COUNT(*) FROM rd_plan_detail)
    + (SELECT COUNT(*) FROM rd_progress)         + (SELECT COUNT(*) FROM rd_progress_detail)
    + (SELECT COUNT(*) FROM rd_prod_info_head)   + (SELECT COUNT(*) FROM rd_prod_info_detail)
    + (SELECT COUNT(*) FROM rd_spec_doc_head)    + (SELECT COUNT(*) FROM rd_spec_doc_detail)
    + (SELECT COUNT(*) FROM rd_mold_proc_head)   + (SELECT COUNT(*) FROM rd_mold_proc_detail)
    + (SELECT COUNT(*) FROM rd_asm_proc_head)    + (SELECT COUNT(*) FROM rd_asm_proc_detail)
    + (SELECT COUNT(*) FROM rd_insp_plan_head)   + (SELECT COUNT(*) FROM rd_insp_plan_detail)
    + (SELECT COUNT(*) FROM rd_change_head)      + (SELECT COUNT(*) FROM rd_change_detail)
    + (SELECT COUNT(*) FROM rd_filter_eff_head)  + (SELECT COUNT(*) FROM rd_filter_eff_detail)
    + (SELECT COUNT(*) FROM rd_alkaline_head)    + (SELECT COUNT(*) FROM rd_alkaline_detail)
    + (SELECT COUNT(*) FROM rd_mineral_head)     + (SELECT COUNT(*) FROM rd_mineral_detail)
    + (SELECT COUNT(*) FROM rd_antibact_head)    + (SELECT COUNT(*) FROM rd_antibact_detail)
    + (SELECT COUNT(*) FROM rd_scale_head)       + (SELECT COUNT(*) FROM rd_scale_detail)
    + (SELECT COUNT(*) FROM rd_ro_protect_head)  + (SELECT COUNT(*) FROM rd_ro_protect_detail)
    + (SELECT COUNT(*) FROM rd_soak_head)        + (SELECT COUNT(*) FROM rd_soak_detail)
    + (SELECT COUNT(*) FROM rd_drop_prec_head)   + (SELECT COUNT(*) FROM rd_drop_prec_detail)
    + (SELECT COUNT(*) FROM rd_spike_water_head) + (SELECT COUNT(*) FROM rd_spike_water_detail)
    + (SELECT COUNT(*) FROM rd_dom_test_head)    + (SELECT COUNT(*) FROM rd_dom_test_detail)
    + (SELECT COUNT(*) FROM rd_equip_use_head)   + (SELECT COUNT(*) FROM rd_equip_use_detail)
    + (SELECT COUNT(*) FROM rd_instr_use_head)   + (SELECT COUNT(*) FROM rd_instr_use_detail)
    + (SELECT COUNT(*) FROM rd_prod_doclist_head)+ (SELECT COUNT(*) FROM rd_prod_doclist_detail)
);
IF @left != 0
BEGIN
    ROLLBACK TRANSACTION;
    RAISERROR(N'研发区残留 %d 行,已整段回滚(未清理干净,请排查)', 16, 1, @left);
    RETURN;
END
COMMIT TRANSACTION;
PRINT N'cleanup-rd-testledger: 测试账套研发区已清空(自检残留 0)';
GO
