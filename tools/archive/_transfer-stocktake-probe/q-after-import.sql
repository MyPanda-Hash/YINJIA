SET NOCOUNT ON;
SELECT h.单据编号, h.单据日期, h.ERP单号, h.审核人 FROM bd_transfer h ORDER BY h.id;
SELECT 单据编号, 序号, 存货编码, ISNULL(批号,N'(NULL)') lot, 调出仓库编码, 调入仓库编码, 数量 FROM bl_transfer ORDER BY 单据编号, 序号;
PRINT '=== 流水 ===';
SELECT src, 单据编号, 物料编码, ISNULL(批号,N'(NULL)') lot, 仓库编码, 数量 FROM inh WHERE src=9 UNION ALL SELECT src, 单据编号, 物料编码, ISNULL(批号,N'(NULL)'), 仓库编码, 数量 FROM outh WHERE src=10;
