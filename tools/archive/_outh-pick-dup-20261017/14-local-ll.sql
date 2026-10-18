SET NOCOUNT ON;
PRINT N'== 本地 s_allno 里的 LL 号 ==';
SELECT dh, lb, ny, asp_user1, CONVERT(varchar(19), asp_time1, 120) t1 FROM dbo.s_allno WHERE dh LIKE 'LL%' ORDER BY id;
PRINT N'== 本地 生产领料/LL 流水的行数 ==';
SELECT COUNT(*) AS 生产领料行 FROM dbo.outh WHERE 单据类型 = N'生产领料';
SELECT COUNT(*) AS LL单号行 FROM dbo.outh WHERE 单据编号 LIKE 'LL%';
PRINT N'== 本地这些 LL 号在 bd_material_out 里有没有对应单据 ==';
SELECT COUNT(*) AS 本地LL号在材料出库单头的命中 FROM dbo.bd_material_out WHERE 单据编号 LIKE 'LL%';
