SET NOCOUNT ON;
-- 服务器快照里的那 1 行「生产领料」/LL 单号流水,逐列打印
SELECT * FROM [HSDZ_MES_SRV1017].dbo.outh WHERE 单据类型 = N'生产领料' OR 单据编号 LIKE N'LL%';

-- 宽松列检出:哪些库的 outh 有 工单号/工单项次 列
SELECT DB_NAME() AS 库,
       COL_LENGTH('dbo.outh', N'工单号')   AS 工单号_长度,
       COL_LENGTH('dbo.outh', N'工单项次') AS 工单项次_长度;
