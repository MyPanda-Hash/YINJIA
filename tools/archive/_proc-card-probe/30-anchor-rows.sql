SET NOCOUNT ON;
SELECT N'--- plang 5/6/47 ---' AS x;
SELECT id, pl_no, pl_xc, ISNULL([批次号],N'(null)') AS 批次号, pl_date FROM dbo.plang WHERE id IN (5,6,47);

SELECT N'--- scjl 该工单的锚/批次 ---' AS x;
SELECT TOP 10 s.id, s.gldh, s.gd_id, ISNULL(s.[批次号],N'(null)') AS 批次号, s.gxdm, s.wgzt, s.ywman
FROM dbo.scjl s WHERE s.gldh = N'GD-2026-09-0009' AND ISNULL(s.asp_cancel,'N')<>'Y' ORDER BY s.id DESC;
