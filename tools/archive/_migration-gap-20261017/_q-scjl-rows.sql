SET NOCOUNT ON;
/* scjl 逐行对照(挑可识别列;jbbh 是 text 类型不能进 EXCEPT,故不做整行 EXCEPT) */
SELECT N'正式库(当前)' AS 库, id, sc_no, [报工单号], gldh AS 工单号, gxdm AS 工序, sl AS 数量,
       RTRIM(ISNULL(wgzt, N'')) AS 完工状态, ISNULL(asp_cancel, N'') AS 作废, ISNULL(asp_user1, N'') AS 建单人,
       CONVERT(varchar(19), sc_date, 120) AS 生产日期, CONVERT(varchar(19), asp_time1, 120) AS 建单时间
FROM [HSDZ_MES].dbo.scjl
UNION ALL
SELECT N'快照(SRV1015)', id, sc_no, [报工单号], gldh, gxdm, sl,
       RTRIM(ISNULL(wgzt, N'')), ISNULL(asp_cancel, N''), ISNULL(asp_user1, N''),
       CONVERT(varchar(19), sc_date, 120), CONVERT(varchar(19), asp_time1, 120)
FROM [HSDZ_MES_SRV1015].dbo.scjl
ORDER BY 库 DESC, id;

/* YJ2 那 8 行是什么 */
SELECT N'YJ2' AS 库, id, sc_no, [报工单号], gldh, gxdm, sl, RTRIM(ISNULL(wgzt, N'')) AS 完工状态,
       ISNULL(asp_cancel, N'') AS 作废, ISNULL(asp_user1, N'') AS 建单人
FROM [HSDZ_MES_YJ2].dbo.scjl ORDER BY id;

/* 各库 asp_user1 分布(看是不是演示/种子数据) */
SELECT N'正式库' AS 库, ISNULL(asp_user1, N'(空)') AS 建单人, COUNT(*) AS 行数 FROM [HSDZ_MES].dbo.scjl GROUP BY asp_user1
UNION ALL SELECT N'快照', ISNULL(asp_user1, N'(空)'), COUNT(*) FROM [HSDZ_MES_SRV1015].dbo.scjl GROUP BY asp_user1
UNION ALL SELECT N'YJ2', ISNULL(asp_user1, N'(空)'), COUNT(*) FROM [HSDZ_MES_YJ2].dbo.scjl GROUP BY asp_user1
UNION ALL SELECT N'测试库', ISNULL(asp_user1, N'(空)'), COUNT(*) FROM [HSDZ_MES_TEST].dbo.scjl GROUP BY asp_user1;
