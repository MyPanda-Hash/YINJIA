SET NOCOUNT ON;
PRINT N'===== A. inh / outh 覆盖范围 =====';
SELECT N'inh' AS 表, MIN(单据日期) AS 起, MAX(单据日期) AS 止, COUNT(*) AS 行数 FROM inh
UNION ALL SELECT N'outh', MIN(单据日期), MAX(单据日期), COUNT(*) FROM outh;
GO
PRINT N'===== B. inh 里属半成品分类的行(按单据类型) =====';
SELECT 单据类型, COUNT(*) AS 行数, MIN(单据日期) AS 起, MAX(单据日期) AS 止
FROM inh h JOIN bs_inv i ON i.存货编码=h.物料编码 WHERE i.所属类别=N'半成品' GROUP BY 单据类型;
GO
PRINT N'===== C. outh 里属半成品分类的行(按单据类型) =====';
SELECT 单据类型, COUNT(*) AS 行数, MIN(单据日期) AS 起, MAX(单据日期) AS 止
FROM outh o JOIN bs_inv i ON i.存货编码=o.物料编码 WHERE i.所属类别=N'半成品' GROUP BY 单据类型;
GO
PRINT N'===== D. 硅胶粉 Y-GL-300400 在金蝶分类里是什么(MES 端登记) =====';
SELECT 存货编码, 存货名称, 所属类别 FROM bs_inv WHERE 存货编码 IN (N'Y-GL-300400', N'B-92-09', N'B-92-13', N'C-95-06', N'C-95-07', N'C-95-12');
