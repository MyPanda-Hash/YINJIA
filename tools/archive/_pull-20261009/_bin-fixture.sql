-- _bin-fixture.sql — 仓位预设/逐仓必填 的测试夹具(只在测试账套执行!)
--   ① A仓(CK-A) 启用仓位管理;A1-09-1 标为该仓默认仓位;
--   ② CL004 物料级默认仓位 = A1-10-1(验证「物料优先」);
--   ③ A-32-01 默认仓位清空(验证「仓库兜底」)。
SET NOCOUNT ON;
PRINT N'夹具库 = ' + DB_NAME();
IF DB_NAME() = N'HSDZ_MES' RAISERROR(N'这是正式库,夹具脚本拒绝执行', 16, 1);

UPDATE bs_wh SET [启用仓位管理] = 1 WHERE RTRIM([仓库编码]) = N'CK-A';
PRINT N'[fixture] A仓 启用仓位管理: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE bs_wh_loc SET [是否默认] = 0 WHERE RTRIM([仓库编码]) = N'CK-A';
UPDATE bs_wh_loc SET [是否默认] = 1 WHERE RTRIM([仓位编码]) = N'A1-09-1' AND RTRIM([仓库编码]) = N'CK-A';
PRINT N'[fixture] A1-09-1 标为该仓默认: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE bs_inv SET [默认仓位] = N'A1-10-1' WHERE RTRIM([存货编码]) = N'CL004';
PRINT N'[fixture] CL004 物料默认仓位: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE bs_inv SET [默认仓位] = NULL WHERE RTRIM([存货编码]) = N'A-32-01';
PRINT N'[fixture] A-32-01 清空默认仓位: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

PRINT N'-- 夹具现状';
SELECT RTRIM(仓库编码) AS 仓, RTRIM(仓库名称) AS 名称, CASE WHEN 启用仓位管理 = 1 THEN N'是' ELSE N'否' END AS 启用仓位管理
  FROM bs_wh WHERE RTRIM(仓库编码) = N'CK-A';
SELECT RTRIM(仓位编码) AS 默认仓位 FROM bs_wh_loc WHERE 是否默认 = 1 AND RTRIM(仓库编码) = N'CK-A';
SELECT RTRIM(存货编码) AS 物料, ISNULL(默认仓位, N'(空)') AS 默认仓位 FROM bs_inv
 WHERE RTRIM(存货编码) IN (N'CL004', N'A-32-01');
