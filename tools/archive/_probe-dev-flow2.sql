/* 只读探针 2:产品开发下发 —— 到底有没有活实例 */
USE HSDZ_MES;
SET NOCOUNT ON;

SELECT N'1 rd_prod_info_head 总行数' AS 项, CAST(COUNT(*) AS nvarchar) AS 值 FROM rd_prod_info_head
UNION ALL SELECT N'2 rd_prod_info_head 未作废', CAST(COUNT(*) AS nvarchar) FROM rd_prod_info_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'3 rd_dev_task 全部行(含作废)', CAST(COUNT(*) AS nvarchar) FROM rd_dev_task
UNION ALL SELECT N'4 rd_dev_task 未作废行', CAST(COUNT(*) AS nvarchar) FROM rd_dev_task WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'5 yj_doc_status RD_PROD_INFO 行', CAST(COUNT(*) AS nvarchar) FROM yj_doc_status WHERE panel_code=N'RD_PROD_INFO'
UNION ALL SELECT N'6 其中已归档', CAST(COUNT(*) AS nvarchar) FROM yj_doc_status WHERE panel_code=N'RD_PROD_INFO' AND ISNULL(archived,'N')='Y'
UNION ALL SELECT N'7 rd_spec_assign 未作废', CAST(COUNT(*) AS nvarchar) FROM rd_spec_assign WHERE ISNULL(asp_cancel,'N')<>'Y';

SELECT 单据编号, 产品编号, 产品名称, ISNULL(责任人, N'(空)') AS 责任人, asp_user1, asp_time1
FROM rd_prod_info_head ORDER BY id DESC;

SELECT panel_code, doc_no, ISNULL(saved,'-') AS saved, ISNULL(archived,'-') AS archived,
       ISNULL(pending,'-') AS pending, ISNULL(canceled,'-') AS canceled,
       CONVERT(nvarchar, archived_at, 120) AS archived_at
FROM yj_doc_status WHERE panel_code = N'RD_PROD_INFO' ORDER BY doc_no;

SELECT TOP 20 产品编号, 目标面板, ISNULL(负责人, N'(挂起)') AS 负责人, 下发人, 源单据号,
       ISNULL(asp_cancel,'N') AS 作废, CONVERT(nvarchar, 下发时间, 120) AS 下发时间
FROM rd_dev_task ORDER BY id DESC;
GO
