-- _q-topicking-status.sql — 测试账套:这两张转领料草稿的 yj_doc_status(只读)
SET NOCOUNT ON;
SELECT s.panel_code, s.doc_no, s.shr, s.pending, ISNULL(s.canceled,N'N') AS canceled, s.saved, s.update_at
FROM yj_doc_status s
WHERE s.panel_code = N'MATERIAL_OUT' AND s.doc_no IN (N'CL-2026-10-0001', N'CL-2026-10-0002', N'CL-2026-09-0002');
PRINT '=== 头表状态列 ===';
SELECT 单据编号, 单据状态, ISNULL(asp_cancel,N'N') AS asp_cancel, asp_user1, asp_time1
FROM bd_material_out WHERE 单据编号 IN (N'CL-2026-10-0001', N'CL-2026-10-0002', N'CL-2026-09-0002');
