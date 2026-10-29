/* ============================================================================
   cleanup-rd-prod-20261029.sql — 正式账套「研发管理模块」一次性清库(为全流程验收)

   用户口径(2026-10-29):「把所有的研发管理模块的数据清理掉,然后开始测试研发管理模块的
   面板的流程与功能是否能用,就填写完整数据开始测试」。

   ⚠⚠ 三条红线:
     ① 只允许在**正式账套 HSDZ_MES** 执行(脚本自带硬闸门)—— 与
        cleanup-rd-testledger-20261016.sql(那份只允许 HSDZ_MES_TEST)正好互补;
     ② **禁止登记进 tools/db-migrations.txt** —— 登记 = DbSync 每次同步都重放一次,
        会反复清掉业务数据(与 migrate-rd-cleanup.sql 等同类脚本的先例一致);
     ③ 执行前必须已有快照:本脚本第一步做 `SELECT INTO` 备份到 rd_bak_20261029_* 表,
        失败可整段 ROLLBACK,备份表**保留**(要恢复见文件末"恢复"段)。

   清什么(清前实测 RdAreaEmptyAudit):
     研发单据 45 张:立项申请 rd_approval(20) / 产品信息表 rd_prod_info(16) /
     规格书 rd_spec_doc(16) / 出货检验计划 rd_insp_plan(17) / 成型工艺清单 rd_mold_proc(5) /
     组装工艺清单 rd_asm_proc(3) / 产品变更 rd_change(1) / 实施计划 rd_plan(3) /
     项目进度 rd_progress(2) / 测试申请 rd_dom_test(8) / 实验室三表 / 功能滤效 rd_filter_eff(9) /
     碱性 rd_alkaline(2) / 加标水 rd_spike_water(1) / 设备使用 rd_equip_use(1);
     以及挂靠数据:单据状态 120 / 审批留痕 110 / 修改记录 5 / 批注 6 / 附件 4 / 消息 49 /
     产品开发任务 8 / 规格书分发 0。

   不清什么(有意保留,**别顺手清掉**):
     · rd_sinter_tolerance(60 行 = 烧结公差**标准库**,不是单据数据)
     · rd_dev_task_bak_20261013 / rd_sample_no_*(历史备份与已下架面板留档)
     · yj_share_file / yj_share_file_cat(共享文件库 = 真实资料)
     · 号池 s_allno(**不归零**:新单号继续往下走)
     · 元数据(yj_panel / yj_field / yj_role_panel)与基础档案

   幂等:整段包在事务里;末尾自检「研发区残留 = 0」,不为 0 就 ROLLBACK + RAISERROR。
   执行:cd tools
     java -cp lib\mssql-jdbc.jar DbSync.java run cleanup-rd-prod-20261029.sql
   ============================================================================ */
SET NOCOUNT ON;

-- ⚠ 两个本机实测踩过的坑(与 cleanup-rd-testledger 同源,别"顺手改回去"):
--   ① 比较写 != 不写 <> —— DbSync/JDBC 执行含 <> 会报「在 'DB_NAME' 附近有语法错误」;
--   ② RAISERROR 的替换参数**只能给变量/常量**,不能给函数调用 ⇒ 先 DECLARE 再传。
DECLARE @db sysname = DB_NAME();
IF @db != N'HSDZ_MES'
BEGIN
    RAISERROR(N'本脚本只允许在正式账套 HSDZ_MES 执行(当前库:%s)', 16, 1, @db);
    RETURN;
END
GO

BEGIN TRANSACTION;

/* ── ⓪ 清理前快照(SELECT INTO;表已存在则跳过,便于重跑) ── */
IF OBJECT_ID('dbo.rd_bak_20261029_approval') IS NULL
    SELECT * INTO dbo.rd_bak_20261029_approval FROM rd_approval;
IF OBJECT_ID('dbo.rd_bak_20261029_prod_info_head') IS NULL
    SELECT * INTO dbo.rd_bak_20261029_prod_info_head FROM rd_prod_info_head;
IF OBJECT_ID('dbo.rd_bak_20261029_prod_info_detail') IS NULL
    SELECT * INTO dbo.rd_bak_20261029_prod_info_detail FROM rd_prod_info_detail;
IF OBJECT_ID('dbo.rd_bak_20261029_spec_doc_head') IS NULL
    SELECT * INTO dbo.rd_bak_20261029_spec_doc_head FROM rd_spec_doc_head;
IF OBJECT_ID('dbo.rd_bak_20261029_spec_doc_detail') IS NULL
    SELECT * INTO dbo.rd_bak_20261029_spec_doc_detail FROM rd_spec_doc_detail;
IF OBJECT_ID('dbo.rd_bak_20261029_insp_plan_head') IS NULL
    SELECT * INTO dbo.rd_bak_20261029_insp_plan_head FROM rd_insp_plan_head;
IF OBJECT_ID('dbo.rd_bak_20261029_mold_proc_head') IS NULL
    SELECT * INTO dbo.rd_bak_20261029_mold_proc_head FROM rd_mold_proc_head;
IF OBJECT_ID('dbo.rd_bak_20261029_asm_proc_head') IS NULL
    SELECT * INTO dbo.rd_bak_20261029_asm_proc_head FROM rd_asm_proc_head;
IF OBJECT_ID('dbo.rd_bak_20261029_doc_status') IS NULL
    SELECT * INTO dbo.rd_bak_20261029_doc_status FROM yj_doc_status WHERE panel_code LIKE N'RD%';
GO

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

/* ── ② 单据状态 / 审批痕迹 / 修改记录 / 批注 / 附件 / 终止申请 / 流转链接 / 单据消息 ──
   ⚠ yj_message 的列名叫 面板编码(不是 panel_code)—— 判据与 RdAreaEmptyAudit ② 同源。 */
DELETE FROM yj_attachment      WHERE panel_code LIKE N'RD%';
DELETE FROM yj_doc_annotation  WHERE panel_code LIKE N'RD%';
DELETE FROM yj_doc_status      WHERE panel_code LIKE N'RD%';
DELETE FROM yj_form_approval   WHERE panel_code LIKE N'RD%';
DELETE FROM yj_doc_modify_log  WHERE panel_code LIKE N'RD%';
DELETE FROM yj_plan_term       WHERE panel_code LIKE N'RD%';
DELETE FROM yj_message         WHERE 面板编码 LIKE N'RD%';
DELETE FROM form_flow_link     WHERE source_panel_code LIKE N'RD%' OR target_panel_code LIKE N'RD%';
GO

/* ── ③ 产品开发任务(按产品编号指向被删的产品信息表) ── */
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
PRINT N'cleanup-rd-prod-20261029: 正式账套研发区已清空(自检残留 0;快照见 rd_bak_20261029_*)';
GO

/* ── 恢复(如需回滚,手工执行;备份表保留不动) ──
   INSERT INTO rd_approval SELECT * FROM rd_bak_20261029_approval;
   INSERT INTO rd_prod_info_head SELECT * FROM rd_bak_20261029_prod_info_head;
   INSERT INTO rd_prod_info_detail SELECT * FROM rd_bak_20261029_prod_info_detail;
   INSERT INTO rd_spec_doc_head SELECT * FROM rd_bak_20261029_spec_doc_head;
   INSERT INTO rd_spec_doc_detail SELECT * FROM rd_bak_20261029_spec_doc_detail;
   INSERT INTO rd_insp_plan_head SELECT * FROM rd_bak_20261029_insp_plan_head;
   INSERT INTO rd_mold_proc_head SELECT * FROM rd_bak_20261029_mold_proc_head;
   INSERT INTO rd_asm_proc_head SELECT * FROM rd_bak_20261029_asm_proc_head;
   INSERT INTO yj_doc_status SELECT * FROM rd_bak_20261029_doc_status;
   (其余表未做逐表快照 —— 它们是演示数据,重录即可)
   ──────────────────────────────────────────────────────────── */
