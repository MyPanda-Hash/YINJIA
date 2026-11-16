SET NOCOUNT ON;
SELECT 'H|' + 单据编号 + '|业务类型=' + ISNULL(业务类型,N'') + '|领用人=' + ISNULL(领用人,N'') + '|工单号=' + ISNULL(加工单号,N'<空>') + '|备注=' + ISNULL(备注,N'')
FROM bd_material_ret WHERE 单据编号 IN ('TL-2026-11-0007','TL-2026-11-0008');
SELECT 'L|' + 单据编号 + '|' + ISNULL(材料编码,N'') + '|' + ISNULL(材料名称,N'') + '|' + ISNULL(计量单位,N'') + '|仓=' + ISNULL(仓库,N'') + '|批号=' + ISNULL(批号,N'<空>') + '|数=' + CAST(ISNULL(数量,0) AS VARCHAR(20)) + '|备注=' + ISNULL(明细备注,N'')
FROM bl_material_ret WHERE 单据编号 IN ('TL-2026-11-0007','TL-2026-11-0008');
SELECT 'OOH|' + 单据编号 + '|业务类型=' + ISNULL(业务类型,N'') + '|经手人=' + ISNULL(经手人,N'') FROM bd_other_out WHERE 单据编号='OO-2026-11-0005';
