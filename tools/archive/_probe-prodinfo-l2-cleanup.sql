/* 探针清理:产品信息表两级审批验收(_probe-prodinfo-l2.cjs),可重复执行 */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-L2-%';
DELETE FROM rd_dev_task        WHERE 产品编号 LIKE N'PROBE-L2-%';
DELETE FROM yj_message         WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval   WHERE panel_code IN (N'RD_PROD_INFO') AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status      WHERE panel_code = N'RD_PROD_INFO' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM rd_prod_info_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_prod_info_head   WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'PROBE-L2-%');
DELETE FROM rd_mold_proc_head   WHERE 产品编号 LIKE N'PROBE-L2-%';
DELETE FROM rd_spec_doc_detail  WHERE 单据编号 IN (SELECT 单据编号 FROM rd_spec_doc_head WHERE 编号 LIKE N'PROBE-L2-%');
DELETE FROM rd_spec_doc_head    WHERE 编号 LIKE N'PROBE-L2-%';
SELECT N'rd_dev_task 残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_dev_task WHERE 产品编号 LIKE N'PROBE-L2-%'
UNION ALL SELECT N'产品信息表残留', CAST(COUNT(*) AS nvarchar) FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-L2-%';
