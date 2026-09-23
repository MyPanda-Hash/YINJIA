/* 探针清理:产品文件全流程走查(_probe-prodfile-e2e.cjs) —— 整条链一次清干净。
   ⚠ 按**测试产品前缀 T-PF-** 圈定(覆盖历次跑,失败的跑也会留数据),不是只清本次那个产品。 */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @prods TABLE (p nvarchar(200) PRIMARY KEY);
INSERT INTO @prods (p) SELECT DISTINCT 产品编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'T-PF-%'
UNION SELECT DISTINCT 产品编号 FROM rd_change_head WHERE 产品编号 LIKE N'T-PF-%'
UNION SELECT DISTINCT 产品编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PF-%'
UNION SELECT DISTINCT 产品编号 FROM rd_asm_proc_head WHERE 产品编号 LIKE N'T-PF-%'
UNION SELECT DISTINCT 编号 FROM rd_spec_doc_head WHERE 编号 LIKE N'T-PF-%';
DECLARE @chg TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @chg (no) SELECT 单据编号 FROM rd_change_head WHERE 产品编号 LIKE N'T-PF-%';
DECLARE @pi TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @pi (no) SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'T-PF-%';
DECLARE @files TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @files (no) SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PF-%' OR 变更来源单号 IN (SELECT no FROM @chg);
INSERT INTO @files (no) SELECT 单据编号 FROM rd_asm_proc_head  WHERE 产品编号 LIKE N'T-PF-%' OR 变更来源单号 IN (SELECT no FROM @chg);
INSERT INTO @files (no) SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'T-PF-%' OR 变更来源单号 IN (SELECT no FROM @chg);
INSERT INTO @files (no) SELECT 单据编号 FROM rd_spec_doc_head  WHERE 编号 LIKE N'T-PF-%' OR 变更来源单号 IN (SELECT no FROM @chg);
DELETE FROM yj_message WHERE 单据编号 IN (SELECT no FROM @chg) OR 单据编号 IN (SELECT no FROM @pi) OR 单据编号 IN (SELECT no FROM @files);
DELETE FROM yj_form_approval WHERE form_no IN (SELECT no FROM @chg) OR form_no IN (SELECT no FROM @pi) OR form_no IN (SELECT no FROM @files);
DELETE FROM yj_doc_status WHERE doc_no IN (SELECT no FROM @chg) OR doc_no IN (SELECT no FROM @pi) OR doc_no IN (SELECT no FROM @files);
DELETE FROM rd_change_detail WHERE 单据编号 IN (SELECT no FROM @chg);
DELETE FROM rd_change_head   WHERE 单据编号 IN (SELECT no FROM @chg);
DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_asm_proc_detail  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_spec_doc_detail  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_insp_plan_detail WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_mold_proc_head WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_asm_proc_head  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_spec_doc_head  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_insp_plan_head WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_prod_info_detail WHERE 单据编号 IN (SELECT no FROM @pi);
DELETE FROM rd_prod_info_head   WHERE 单据编号 IN (SELECT no FROM @pi);
DELETE FROM rd_dev_task WHERE 产品编号 LIKE N'T-PF-%';
-- 部门账号(本次走查补的测试数据;要留用就注释掉下面这行)
DELETE FROM yj_user WHERE username IN (N'probe_craft', N'probe_asm', N'probe_sale', N'probe_qc', N'probe_plan', N'probe_wh');
SELECT N'变更单残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_change_head WHERE 产品编号 LIKE N'T-PF-%'
UNION ALL SELECT N'产品信息表残留', CAST(COUNT(*) AS nvarchar) FROM rd_prod_info_head WHERE 产品编号 LIKE N'T-PF-%'
UNION ALL SELECT N'四文件残留', CAST(COUNT(*) AS nvarchar) FROM (
  SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PF-%'
  UNION ALL SELECT 单据编号 FROM rd_asm_proc_head WHERE 产品编号 LIKE N'T-PF-%'
  UNION ALL SELECT 单据编号 FROM rd_spec_doc_head WHERE 编号 LIKE N'T-PF-%'
  UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'T-PF-%') t
UNION ALL SELECT N'责任人行残留', CAST(COUNT(*) AS nvarchar) FROM rd_dev_task WHERE 产品编号 LIKE N'T-PF-%'
UNION ALL SELECT N'部门账号残留', CAST(COUNT(*) AS nvarchar) FROM yj_user WHERE username LIKE N'probe[_]%';
