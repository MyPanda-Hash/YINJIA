SELECT TOP 10 dm, mc FROM dm_gf WHERE mc LIKE N'%元丰%' OR dm LIKE N'%YFHX%'
GO
SELECT TOP 5 dm, mc FROM dm_gf ORDER BY dm
GO
SELECT 物料编码 FROM qc_return_detail WHERE 单据编号='TH-2026-10-0047'
