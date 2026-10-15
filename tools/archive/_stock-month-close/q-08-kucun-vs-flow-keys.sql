-- q-08-kucun-vs-flow-keys.sql — kucun 里「流水里根本没这个键」的残留行(重算只做 upsert、不删旧键)
SET NOCOUNT ON;
SELECT N'kucun vs 流水' AS k,
       (SELECT CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) FROM kucun) AS kucun现存量,
       (SELECT CAST(SUM(收入数量 - 发出数量) AS decimal(18,4)) FROM v_stock_movement) AS 流水净额,
       (SELECT CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) FROM kucun k
         WHERE NOT EXISTS (SELECT 1 FROM inh x WHERE ISNULL(RTRIM(x.物料编码),N'') = k.wzdm
                             AND ISNULL(RTRIM(x.仓库编码),N'') = k.ckdm AND ISNULL(RTRIM(x.批号),N'') = ISNULL(RTRIM(k.lot_no),N'')
                             AND ISNULL(x.asp_cancel,'N') <> 'Y')
           AND NOT EXISTS (SELECT 1 FROM outh y WHERE ISNULL(RTRIM(y.物料编码),N'') = k.wzdm
                             AND ISNULL(RTRIM(y.仓库编码),N'') = k.ckdm AND ISNULL(RTRIM(y.批号),N'') = ISNULL(RTRIM(k.lot_no),N'')
                             AND ISNULL(y.asp_cancel,'N') <> 'Y')) AS 流水里没这个键的余量,
       (SELECT COUNT(*) FROM kucun k
         WHERE NOT EXISTS (SELECT 1 FROM inh x WHERE ISNULL(RTRIM(x.物料编码),N'') = k.wzdm
                             AND ISNULL(RTRIM(x.仓库编码),N'') = k.ckdm AND ISNULL(RTRIM(x.批号),N'') = ISNULL(RTRIM(k.lot_no),N'')
                             AND ISNULL(x.asp_cancel,'N') <> 'Y')
           AND NOT EXISTS (SELECT 1 FROM outh y WHERE ISNULL(RTRIM(y.物料编码),N'') = k.wzdm
                             AND ISNULL(RTRIM(y.仓库编码),N'') = k.ckdm AND ISNULL(RTRIM(y.批号),N'') = ISNULL(RTRIM(k.lot_no),N'')
                             AND ISNULL(y.asp_cancel,'N') <> 'Y')) AS 残留键数;
GO
SELECT N'残留按来源' AS k, ISNULL(asp_user1, N'(空)') AS 来源, COUNT(*) AS 行数,
       CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) AS 余量
FROM kucun k
WHERE NOT EXISTS (SELECT 1 FROM inh x WHERE ISNULL(RTRIM(x.物料编码),N'') = k.wzdm
                    AND ISNULL(RTRIM(x.仓库编码),N'') = k.ckdm AND ISNULL(RTRIM(x.批号),N'') = ISNULL(RTRIM(k.lot_no),N'')
                    AND ISNULL(x.asp_cancel,'N') <> 'Y')
  AND NOT EXISTS (SELECT 1 FROM outh y WHERE ISNULL(RTRIM(y.物料编码),N'') = k.wzdm
                    AND ISNULL(RTRIM(y.仓库编码),N'') = k.ckdm AND ISNULL(RTRIM(y.批号),N'') = ISNULL(RTRIM(k.lot_no),N'')
                    AND ISNULL(y.asp_cancel,'N') <> 'Y')
GROUP BY ISNULL(asp_user1, N'(空)') ORDER BY 行数 DESC;
GO
