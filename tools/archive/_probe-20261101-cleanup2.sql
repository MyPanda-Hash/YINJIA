SET NOCOUNT ON;
DELETE FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-OPNAME';
DELETE FROM dbo.yj_doc_status WHERE panel_code=N'WO_REPORT' AND doc_no=N'BG-TEST-OPNAME';
DELETE FROM dbo.yj_form_approval WHERE panel_code=N'WO_REPORT' AND form_no=N'BG-TEST-OPNAME';
SELECT (SELECT COUNT(*) FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-OPNAME') AS scjl,
       (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE doc_no=N'BG-TEST-OPNAME') AS 状态,
       (SELECT COUNT(*) FROM dbo.yj_form_approval WHERE form_no=N'BG-TEST-OPNAME') AS 留痕;
