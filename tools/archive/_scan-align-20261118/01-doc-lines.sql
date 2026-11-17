SET NOCOUNT ON;
SELECT l.物料编码, l.物料名称, l.实领数量, l.批号 FROM wo_pick_line l
JOIN wo_pick_doc d ON d.id = l.单头id WHERE d.领料单号 = N'LL-2026-11-0025' ORDER BY l.行号;
