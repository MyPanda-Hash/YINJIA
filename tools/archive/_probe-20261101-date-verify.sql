SET NOCOUNT ON;
SELECT id,[报工单号],sc_date,gldh,[工单行号],gxdm,sl FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-DATE';
DELETE FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-DATE';
DELETE FROM dbo.yj_doc_status WHERE doc_no=N'BG-TEST-DATE';
DELETE FROM dbo.yj_form_approval WHERE form_no=N'BG-TEST-DATE';
SELECT (SELECT COUNT(*) FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-DATE') AS 清理后行数;
