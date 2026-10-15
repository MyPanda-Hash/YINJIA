-- q-19-kucun-facts.sql — 「库存明细」上线前的数据事实(写给报表读表人看的口径数字)
SET NOCOUNT ON;
SELECT N'总量' AS k, COUNT(*) AS 行数,
       SUM(ISNULL(yl,0)) AS 现存量合计,
       SUM(CASE WHEN ISNULL(yl,0) < 0 THEN 1 ELSE 0 END) AS 负现存量行,
       SUM(CASE WHEN ISNULL(yl,0) < 0 THEN ISNULL(yl,0) ELSE 0 END) AS 负现存量合计,
       SUM(CASE WHEN ISNULL(yl,0) = 0 THEN 1 ELSE 0 END) AS 零现存量行
FROM kucun;
GO
SELECT N'批号维度' AS k,
       SUM(CASE WHEN lot_no IS NULL OR LTRIM(RTRIM(lot_no)) = '' THEN 1 ELSE 0 END) AS 无批号行,
       COUNT(DISTINCT lot_no) AS 批号数,
       SUM(CASE WHEN lot_no IS NOT NULL AND LTRIM(RTRIM(lot_no)) <> '' THEN ISNULL(yl,0) ELSE 0 END) AS 有批号现存量
FROM kucun;
GO
SELECT N'来源 × 是否自洽' AS k, asp_user1,
       COUNT(*) AS 行数,
       SUM(CASE WHEN ABS(ISNULL(yl,0) - (ISNULL(rkl,0) - ISNULL(ckl,0))) <= 0.005 THEN 1 ELSE 0 END) AS 自洽行,
       SUM(CASE WHEN ISNULL(price,0) > 0 THEN 1 ELSE 0 END) AS 有单价行
FROM kucun GROUP BY asp_user1 ORDER BY 行数 DESC;
GO
SELECT N'负现存量来源' AS k, asp_user1, COUNT(*) AS 行数, SUM(yl) AS 合计
FROM kucun WHERE ISNULL(yl,0) < 0 GROUP BY asp_user1 ORDER BY 行数 DESC;
GO
SELECT N'悬空物料(不在 bs_inv)' AS k, wzdm, ckdm, lot_no, yl
FROM (SELECT TOP 13 k.wzdm, k.ckdm, k.lot_no, k.yl FROM kucun k
      WHERE NOT EXISTS (SELECT 1 FROM bs_inv i WHERE i.存货编码 = k.wzdm) ORDER BY k.yl DESC) t;
GO
SELECT N'索引与列(供报表取数)' AS k, i.name AS 索引名, i.type_desc,
       STUFF((SELECT ',' + c2.name FROM sys.index_columns ic2 JOIN sys.columns c2 ON c2.object_id = ic2.object_id AND c2.column_id = ic2.column_id
              WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id AND ic2.is_included_column = 0
              ORDER BY ic2.key_ordinal FOR XML PATH('')), 1, 1, '') AS 键列
FROM sys.indexes i WHERE i.object_id = OBJECT_ID('kucun') AND i.type > 0;
GO
