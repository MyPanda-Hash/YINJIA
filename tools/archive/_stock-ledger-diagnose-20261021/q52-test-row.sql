SET NOCOUNT ON;
SELECT 'inh' AS 表, 单据编号, 单据日期, 批号 = ISNULL(批号,'<NULL>'), 数量, 单据类型, asp_user1
FROM inh WHERE 物料编码 = 'YJ-SX-038' AND 仓库编码 = 'YCL-01'
UNION ALL
SELECT 'outh', 单据编号, 单据日期, ISNULL(批号,'<NULL>'), 数量, 单据类型, asp_user1
FROM outh WHERE 物料编码 = 'YJ-SX-038' AND 仓库编码 = 'YCL-01';

SELECT 批号长度 = LEN(批号), 批号 = '[' + ISNULL(批号,'<NULL>') + ']' FROM inh WHERE 物料编码 = 'YJ-SX-038' AND 仓库编码 = 'YCL-01';
SELECT 批号长度 = LEN(lot_no), 批号 = '[' + ISNULL(lot_no,'<NULL>') + ']' FROM kucun WHERE wzdm = 'YJ-SX-038';
