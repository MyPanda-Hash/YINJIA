SET NOCOUNT ON;
SELECT 'H|' + 单据编号 + '|业务类型=' + ISNULL(业务类型,N'') + '|经手人=' + ISNULL(经手人,N'<空>') + '|备注=' + ISNULL(备注,N'')
FROM bd_other_out WHERE 单据编号='OO-2026-11-0006';
SELECT 'L|' + ISNULL(存货编码,N'') + '|仓=' + ISNULL(仓库,N'') + '|数=' + CAST(ISNULL(数量,0) AS VARCHAR(20)) FROM bl_other_out WHERE 单据编号='OO-2026-11-0006';
