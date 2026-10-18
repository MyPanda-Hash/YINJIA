SET NOCOUNT ON;
PRINT '=== 本次补录产生的流水(src 9/10, YCD 单号) ===';
SELECT 'inh' t, src, 单据编号, 物料编码, ISNULL(批号,'(NULL)') lot, 仓库编码, 数量 FROM inh WHERE 单据编号 LIKE 'YCD%'
UNION ALL
SELECT 'outh', src, 单据编号, 物料编码, ISNULL(批号,'(NULL)'), 仓库编码, -数量 FROM outh WHERE 单据编号 LIKE 'YCD%';
