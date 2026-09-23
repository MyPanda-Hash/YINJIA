/* 探针清理:产品变更申请单 会签/审批/生效验收(_probe-change-flow.cjs) */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @docs (no) VALUES (N'CHG-2026-09-0012'), (N'CHG-2026-09-0013');
DECLARE @made TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @made (no) SELECT 单据编号 FROM rd_mold_proc_head WHERE 变更来源单号 IN (SELECT no FROM @docs);
INSERT INTO @made (no) SELECT 单据编号 FROM rd_asm_proc_head  WHERE 变更来源单号 IN (SELECT no FROM @docs);
INSERT INTO @made (no) SELECT 单据编号 FROM rd_insp_plan_head WHERE 变更来源单号 IN (SELECT no FROM @docs);
INSERT INTO @made (no) SELECT 单据编号 FROM rd_spec_doc_head  WHERE 变更来源单号 IN (SELECT no FROM @docs);
DELETE FROM yj_message WHERE 单据编号 IN (SELECT no FROM @docs) OR 单据编号 IN (SELECT no FROM @made);
DELETE FROM yj_form_approval WHERE panel_code = N'RD_CHANGE' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status WHERE (panel_code = N'RD_CHANGE' AND doc_no IN (SELECT no FROM @docs))
   OR doc_no IN (SELECT no FROM @made) OR (panel_code = N'RD_MOLD_PROC' AND doc_no = N'MP-2026-09-0107');
DELETE FROM rd_change_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_change_head   WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (SELECT no FROM @made) OR 单据编号 = N'MP-2026-09-0107';
DELETE FROM rd_asm_proc_detail  WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_insp_plan_detail WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_spec_doc_detail  WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_mold_proc_head WHERE 单据编号 IN (SELECT no FROM @made) OR 单据编号 = N'MP-2026-09-0107' OR 产品编号 = N'PROBE-CHGP-119983';
DELETE FROM rd_asm_proc_head  WHERE 单据编号 IN (SELECT no FROM @made) OR 产品编号 = N'PROBE-CHGP-119983';
DELETE FROM rd_insp_plan_head WHERE 单据编号 IN (SELECT no FROM @made) OR 产品编号 = N'PROBE-CHGP-119983';
DELETE FROM rd_spec_doc_head  WHERE 单据编号 IN (SELECT no FROM @made) OR 编号 = N'PROBE-CHGP-119983';
DELETE FROM rd_dev_task WHERE 产品编号 = N'PROBE-CHGP-119983';
DELETE FROM yj_user WHERE username = N'probe-nodept';
SELECT N'变更单残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_change_head WHERE 单据编号 IN (SELECT no FROM @docs);
