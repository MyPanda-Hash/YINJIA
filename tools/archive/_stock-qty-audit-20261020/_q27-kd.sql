SET NOCOUNT ON;
PRINT N'== 金蝶同步快照「库存数量」与 MES 台账现存量 对照 ==';
SELECT TOP 20 单据编号, 材料名称, 计量单位, 数量, 库存数量, asp_time1
FROM dbo.bl_material_out
WHERE 材料名称 IN (N'鑫恒酸性（80*250）水洗', N'HP-08', N'方解石（20-40目）', N'碱3（40-80目）')
ORDER BY asp_time1 DESC;
