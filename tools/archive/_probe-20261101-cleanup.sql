SET NOCOUNT ON;
PRINT '=== 清理前统计 ===';
SELECT (SELECT COUNT(*) FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-ANCHOR') AS scjl行,
       (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE doc_no=N'BG-TEST-ANCHOR') AS 状态行,
       (SELECT COUNT(*) FROM dbo.yj_form_approval WHERE form_no=N'BG-TEST-ANCHOR') AS 审批留痕行;
DELETE FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-ANCHOR';
DELETE FROM dbo.yj_doc_status WHERE panel_code=N'WO_REPORT' AND doc_no=N'BG-TEST-ANCHOR';
DELETE FROM dbo.yj_form_approval WHERE panel_code=N'WO_REPORT' AND form_no=N'BG-TEST-ANCHOR';
PRINT '=== 清理后统计(应全 0) ===';
SELECT (SELECT COUNT(*) FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-ANCHOR') AS scjl行,
       (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE doc_no=N'BG-TEST-ANCHOR') AS 状态行,
       (SELECT COUNT(*) FROM dbo.yj_form_approval WHERE form_no=N'BG-TEST-ANCHOR') AS 审批留痕行;
