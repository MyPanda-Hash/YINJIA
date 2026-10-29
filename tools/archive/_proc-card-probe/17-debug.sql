SET NOCOUNT ON;
SELECT N'--- plang 1146/1147 ---' AS x;
SELECT id, pl_no, pl_xc, [批次号] FROM dbo.plang WHERE id IN (1146,1147);
SELECT N'--- plang GD-2026-10-0018 全行 ---' AS x;
SELECT id, pl_no, pl_xc, [批次号] FROM dbo.plang WHERE pl_no = N'GD-2026-10-0018' ORDER BY id;
SELECT N'--- scjl 该工单行数 ---' AS x;
SELECT COUNT(*) AS n FROM dbo.scjl s WHERE s.gldh = N'GD-2026-10-0018';
SELECT N'--- scjl gd_id 命中 plang_pc 的行 ---' AS x;
SELECT TOP 10 s.id, s.gldh, s.gd_id, s.gxdm, pc.plang_id, s.[批次号]
FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id
WHERE s.gldh = N'GD-2026-10-0018' ORDER BY s.id DESC;
