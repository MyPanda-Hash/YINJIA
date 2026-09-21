/* _probe-change-cleanup-all.sql —— 清理历次探针跑失败时留下的 CHG 单据与生成物(按探针特征精确圈定) */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_change_head
 WHERE 产品编号 LIKE N'PROBE-CHGP-%' OR 变更事由 LIKE N'探针%' OR 产品编号 LIKE N'PROBE-%';
DECLARE @made TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @made (no) SELECT 单据编号 FROM rd_mold_proc_head WHERE 变更来源单号 IN (SELECT no FROM @docs) OR 产品编号 LIKE N'PROBE-CHGP-%';
INSERT INTO @made (no) SELECT 单据编号 FROM rd_asm_proc_head  WHERE 变更来源单号 IN (SELECT no FROM @docs) OR 产品编号 LIKE N'PROBE-CHGP-%';
INSERT INTO @made (no) SELECT 单据编号 FROM rd_insp_plan_head WHERE 变更来源单号 IN (SELECT no FROM @docs) OR 产品编号 LIKE N'PROBE-CHGP-%';
INSERT INTO @made (no) SELECT 单据编号 FROM rd_spec_doc_head  WHERE 变更来源单号 IN (SELECT no FROM @docs) OR 编号 LIKE N'PROBE-CHGP-%';
DELETE FROM yj_message WHERE 单据编号 IN (SELECT no FROM @docs) OR 单据编号 IN (SELECT no FROM @made);
DELETE FROM yj_form_approval WHERE form_no IN (SELECT no FROM @docs) OR form_no IN (SELECT no FROM @made);
DELETE FROM yj_doc_status WHERE doc_no IN (SELECT no FROM @docs) OR doc_no IN (SELECT no FROM @made);
DELETE FROM rd_change_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_change_head   WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_asm_proc_detail  WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_insp_plan_detail WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_spec_doc_detail  WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_mold_proc_head WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_asm_proc_head  WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_insp_plan_head WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_spec_doc_head  WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_dev_task WHERE 产品编号 LIKE N'PROBE-%';
SELECT N'CHG 残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_change_head WHERE 产品编号 LIKE N'PROBE-%' OR 变更事由 LIKE N'探针%'
UNION ALL SELECT N'rd_dev_task 残留', CAST(COUNT(*) AS nvarchar) FROM rd_dev_task WHERE 产品编号 LIKE N'PROBE-%'
UNION ALL SELECT N'四文件探针残留', CAST(COUNT(*) AS nvarchar) FROM (
  SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'PROBE-%'
  UNION ALL SELECT 单据编号 FROM rd_asm_proc_head WHERE 产品编号 LIKE N'PROBE-%'
  UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'PROBE-%'
  UNION ALL SELECT 单据编号 FROM rd_spec_doc_head WHERE 编号 LIKE N'PROBE-%') t
UNION ALL SELECT N'探针账号残留', CAST(COUNT(*) AS nvarchar) FROM yj_user WHERE username = N'probe-nodept';
GO
