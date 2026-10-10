SET NOCOUNT ON;
PRINT N'-- 计量单位(bs_uom)';
SELECT TOP 20 计量单位编码, 计量单位名称 FROM bs_uom ORDER BY 计量单位编码;
PRINT N'-- A-32-01 商品档案关键列';
SELECT TOP 3 存货编码, 存货名称, 计量单位, 来料检验 FROM bs_inv WHERE LTRIM(RTRIM(存货编码)) IN (N'A-32-01', N'CL004');
PRINT N'-- 严重程度 / 最终处理结果 字典';
SELECT * FROM yj_dict WHERE 字典类别 IN (N'严重程度', N'最终处理结果') OR 字典编码 IN (N'YZCD', N'ZZCLJG');
