SET NOCOUNT ON;
PRINT '=== YJ-SX-029 的流水(看是否被扣过两次) ===';
SELECT 单据编号, ISNULL(批号,'<NULL>') lot, 数量, 单据日期 FROM inh WHERE 物料编码=N'YJ-SX-029' AND 仓库编码=N'CK00006' ORDER BY 单据日期;
SELECT 单据编号, ISNULL(批号,'<NULL>') lot, 数量, 单据日期 FROM outh WHERE 物料编码=N'YJ-SX-029' AND 仓库编码=N'CK00006' ORDER BY 单据日期;
PRINT '=== 该物料该仓流水净额 ===';
SELECT (SELECT ISNULL(SUM(数量),0) FROM inh WHERE 物料编码=N'YJ-SX-029' AND 仓库编码=N'CK00006' AND ISNULL(asp_cancel,'N')<>'Y')
     - (SELECT ISNULL(SUM(数量),0) FROM outh WHERE 物料编码=N'YJ-SX-029' AND 仓库编码=N'CK00006' AND ISNULL(asp_cancel,'N')<>'Y') AS 净额,
       (SELECT yl FROM kucun WHERE wzdm=N'YJ-SX-029' AND ckdm=N'CK00006' AND lot_no IS NULL) AS kucun;
