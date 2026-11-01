SET NOCOUNT ON;
SELECT id,[报工单号],sc_date,wgsj,ISNULL(wgzt,'') AS wgzt FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-SUBDATE';
SELECT doc_no,pending,pending_by FROM dbo.yj_doc_status WHERE doc_no=N'BG-TEST-SUBDATE';
