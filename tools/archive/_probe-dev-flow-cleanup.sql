/* 探针清理:产品开发下发链路实跑(_probe-dev-flow.cjs)生成,可安全重复执行 */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-DEV-%';
DELETE FROM rd_dev_task        WHERE 产品编号 LIKE N'PROBE-DEV-%';
DELETE FROM yj_message         WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval   WHERE panel_code = N'RD_PROD_INFO' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_modify_log  WHERE panel_code = N'RD_PROD_INFO' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status      WHERE panel_code = N'RD_PROD_INFO' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM rd_prod_info_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_prod_info_head   WHERE 单据编号 IN (SELECT no FROM @docs);
SELECT N'rd_dev_task 残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_dev_task WHERE 产品编号 LIKE N'PROBE-DEV-%'
UNION ALL SELECT N'rd_prod_info_head 残留', CAST(COUNT(*) AS nvarchar) FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-DEV-%'
UNION ALL SELECT N'本次单号', CAST(COUNT(*) AS nvarchar) FROM @docs;
