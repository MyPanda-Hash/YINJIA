-- 仓库档案补齐所需信息(只读):金蝶18仓 vs MES bs_wh 15仓
SET NOCOUNT ON;

PRINT N'=== ① bs_wh 全部列 ===';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS 长度, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'bs_wh' ORDER BY ORDINAL_POSITION;
GO

PRINT N'=== ② bs_wh 现有 15 行明细 ===';
SELECT * FROM bs_wh ORDER BY 仓库编码;
GO

PRINT N'=== ③ MES 侧未建立的金蝶仓(根据历史取证 18 仓对照)===';
SELECT v.仓库编码 FROM (VALUES (N'YJ-01'),(N'YJ-02'),(N'YJ-03'),(N'YJ-04'),(N'YJ-05'),(N'YJ-06'),
  (N'YJ-07'),(N'YJ-08'),(N'CP-01'),(N'CP-02'),(N'CP-03'),(N'CK00003'),(N'CK00004'),(N'CK00005'),
  (N'CK00006'),(N'YCL-01'),(N'YCL-02'),(N'YCL-03')) v(仓库编码)
 WHERE NOT EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库编码) = v.仓库编码);
GO
