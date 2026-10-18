SET NOCOUNT ON;
SELECT wzdm, ISNULL(lot_no,'<NULL>') lot, yl, rkl, ckl FROM kucun WHERE ckdm=N'CK00006' AND wzdm IN (N'YJ-AJ-016-1',N'YJ-SX-003-1',N'YJ-HKB-003',N'YJ-SX-029',N'YJ-SX-062') ORDER BY wzdm;
PRINT '=== 本次产生的流水 ===';
SELECT 'inh' t, src, 单据编号, 物料编码, ISNULL(批号,'<NULL>') lot, 数量 FROM inh WHERE 单据编号 LIKE 'YCD%'
UNION ALL SELECT 'outh', src, 单据编号, 物料编码, ISNULL(批号,'<NULL>'), -数量 FROM outh WHERE 单据编号 LIKE 'YCD%' ORDER BY 单据编号, t;
