SET NOCOUNT ON;
SELECT 单据编号, 行序, 子件编码, 子件名称, 计量单位, 标准用量 FROM bs_asm_bom
WHERE 单据编号 IN (N'T348_V0001', N'C-90-01_V0003', N'B-70-03_V0002', N'A-32-06_V0003')
ORDER BY 单据编号, 行序;
