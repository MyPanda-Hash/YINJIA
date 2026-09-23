SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('form_flow_link') ORDER BY column_id;
GO
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('yj_attachment') ORDER BY column_id;
GO
SELECT N'rd_sample_no_head' AS t, CASE WHEN OBJECT_ID('rd_sample_no_head') IS NULL THEN N'缺' ELSE N'有' END AS 存在
UNION ALL SELECT N'rd_dom_test_head', CASE WHEN OBJECT_ID('rd_dom_test_head') IS NULL THEN N'缺' ELSE N'有' END
UNION ALL SELECT N'rd_prod_info_detail', CASE WHEN OBJECT_ID('rd_prod_info_detail') IS NULL THEN N'缺' ELSE N'有' END
UNION ALL SELECT N'yj_doc_modify_log', CASE WHEN OBJECT_ID('yj_doc_modify_log') IS NULL THEN N'缺' ELSE N'有' END;
GO
