SET NOCOUNT ON;
/* 各库 scjl 的 id 区间与建单人分布 */
SELECT N'正式库' AS 库, MIN(id) AS 最小id, MAX(id) AS 最大id, COUNT(*) AS 行数,
       IDENT_CURRENT(N'dbo.scjl') AS 标识当前值 FROM (SELECT id FROM [HSDZ_MES].dbo.scjl) x
UNION ALL
SELECT N'快照SRV1015', MIN(id), MAX(id), COUNT(*), IDENT_CURRENT(N'[HSDZ_MES_SRV1015].dbo.scjl') FROM [HSDZ_MES_SRV1015].dbo.scjl
UNION ALL
SELECT N'YJ2', MIN(id), MAX(id), COUNT(*), IDENT_CURRENT(N'[HSDZ_MES_YJ2].dbo.scjl') FROM [HSDZ_MES_YJ2].dbo.scjl
UNION ALL
SELECT N'测试库', MIN(id), MAX(id), COUNT(*), IDENT_CURRENT(N'[HSDZ_MES_TEST].dbo.scjl') FROM [HSDZ_MES_TEST].dbo.scjl;

/* 关键 id 是否存在于各库 */
SELECT N'11,12,13,14,16,17,20(经典行)' AS 关注行,
       (SELECT COUNT(*) FROM [HSDZ_MES].dbo.scjl WHERE id IN (11,12,13,14,16,17,20)) AS 正式库,
       (SELECT COUNT(*) FROM [HSDZ_MES_SRV1015].dbo.scjl WHERE id IN (11,12,13,14,16,17,20)) AS 快照,
       (SELECT COUNT(*) FROM [HSDZ_MES_YJ2].dbo.scjl WHERE id IN (11,12,13,14,16,17,20)) AS YJ2,
       (SELECT COUNT(*) FROM [HSDZ_MES_TEST].dbo.scjl WHERE id IN (11,12,13,14,16,17,20)) AS 测试库
UNION ALL
SELECT N'76,77,78,79(本地新行)',
       (SELECT COUNT(*) FROM [HSDZ_MES].dbo.scjl WHERE id IN (76,77,78,79)),
       (SELECT COUNT(*) FROM [HSDZ_MES_SRV1015].dbo.scjl WHERE id IN (76,77,78,79)),
       (SELECT COUNT(*) FROM [HSDZ_MES_YJ2].dbo.scjl WHERE id IN (76,77,78,79)),
       (SELECT COUNT(*) FROM [HSDZ_MES_TEST].dbo.scjl WHERE id IN (76,77,78,79));

/* 测试库里 scjl 的建单人分布(id 段) */
SELECT N'测试库' AS 库,
       CASE WHEN id <= 20 THEN N'id<=20(经典)'
            WHEN id BETWEEN 21 AND 75 THEN N'id 21-75'
            ELSE N'id>=76(本地段)' END AS 区段,
       COUNT(*) AS 行数, MIN(id) AS 最小, MAX(id) AS 最大
FROM [HSDZ_MES_TEST].dbo.scjl GROUP BY CASE WHEN id <= 20 THEN N'id<=20(经典)' WHEN id BETWEEN 21 AND 75 THEN N'id 21-75' ELSE N'id>=76(本地段)' END
ORDER BY 区段;
