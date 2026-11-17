SET NOCOUNT ON;
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE (TABLE_NAME = 'bs_asm_bom' AND COLUMN_NAME IN (N'标准用量',N'用量分子',N'用量分母',N'单据编号',N'来源',N'产品编码',N'产品名称',N'规格型号',N'版本号',N'默认BOM',N'工艺路线名称',N'状态',N'行备注',N'子件规格'))
   OR (TABLE_NAME = 'mate' AND COLUMN_NAME IN (N'm_no',N'wzdm1',N'wzmc1',N'jldw1',N'wzdm2',N'wzmc2',N'gg2',N'jldw2',N'bzl',N'sl2',N'bz'))
ORDER BY TABLE_NAME, ORDINAL_POSITION;
