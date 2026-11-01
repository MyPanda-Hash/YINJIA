SET NOCOUNT ON;
UPDATE dbo.yj_doc_status SET pending='N', pending_by=NULL, shr=NULL, shsj=NULL, approve_node=NULL, update_at=GETDATE()
WHERE panel_code=N'WO_REPORT' AND doc_no=N'BG-TEST-ANCHOR';
UPDATE dbo.scjl SET gldh=N'GD-2026-10-0012', [工单行号]=0, [批次号]=NULL, gd_id=0, wgzt=NULL
WHERE [报工单号]=N'BG-TEST-ANCHOR';
SELECT id,[报工单号],gldh,[工单行号],ISNULL([批次号],N'(空)') AS 批次号 FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-ANCHOR';
SELECT doc_no, pending FROM dbo.yj_doc_status WHERE doc_no=N'BG-TEST-ANCHOR';
