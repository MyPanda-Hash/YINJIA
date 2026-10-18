SET NOCOUNT ON;
SELECT id, wzdm, ckdm, ISNULL(lot_no,'<NULL>') lot, yl, rkl, ckl, asp_user2 FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006';
PRINT '=== 该物料该仓在流水侧的构成 ===';
SELECT TOP 5 单据编号, 批号, 数量, 单据日期 FROM inh WHERE 物料编码=N'YJ-AJ-016-1' AND 仓库编码=N'CK00006' ORDER BY 单据日期;
