SET NOCOUNT ON;
DELETE FROM dbo.bl_finish_in WHERE 单据编号 = N'FI-UI-QTY-01';
DELETE FROM dbo.yj_form_approval WHERE panel_code=N'FINISH_IN' AND form_no=N'FI-UI-QTY-01';
DELETE FROM dbo.yj_doc_status WHERE panel_code=N'FINISH_IN' AND doc_no=N'FI-UI-QTY-01';
DELETE FROM dbo.bd_finish_in WHERE 单据编号 = N'FI-UI-QTY-01';
SELECT (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE 单据编号=N'FI-UI-QTY-01') AS heads,
       (SELECT COUNT(*) FROM dbo.bl_finish_in WHERE 单据编号=N'FI-UI-QTY-01') AS lines,
       (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE doc_no=N'FI-UI-QTY-01') AS stat,
       (SELECT COUNT(*) FROM dbo.yj_form_approval WHERE form_no=N'FI-UI-QTY-01') AS trail;
