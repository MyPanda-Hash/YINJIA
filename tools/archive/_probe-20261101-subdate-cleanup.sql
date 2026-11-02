SET NOCOUNT ON;
DELETE FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-SUBDATE';
DELETE FROM dbo.yj_doc_status WHERE doc_no=N'BG-TEST-SUBDATE';
DELETE FROM dbo.yj_form_approval WHERE form_no=N'BG-TEST-SUBDATE';
SELECT (SELECT COUNT(*) FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-SUBDATE') AS scjl,
       (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE doc_no=N'BG-TEST-SUBDATE') AS 状态;
