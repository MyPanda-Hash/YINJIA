SET NOCOUNT ON;
UPDATE dbo.yj_doc_status SET pending='N', pending_by=NULL, shr=NULL, shsj=NULL, approve_node=NULL, update_at=GETDATE()
WHERE panel_code=N'WO_REPORT' AND doc_no=N'BG-TEST-OPNAME';
UPDATE dbo.scjl SET gxdm=NULL, wgzt=NULL, wgsj=NULL WHERE [报工单号]=N'BG-TEST-OPNAME';
SELECT id,[报工单号],gxdm FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-OPNAME';
