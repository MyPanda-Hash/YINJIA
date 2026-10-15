-- q-06-split-cause.sql — 同一(物料,仓库)多行,按「批号体系」归因:日期不同 / 供应商不同 / 有无批号混存 / 金蝶批号
SET NOCOUNT ON;
-- ① 先看事实:同一(物料,仓库)的批号里,「日期」到底有几个(供应商-日期型才可解析出日期)
SELECT N'同一仓同存货的批号构成' AS k,
       CASE WHEN 行数 = 1 THEN N'1 行(不拆)' ELSE N'多行' END AS 分组,
       COUNT(*) AS 组数,
       SUM(CASE WHEN 有日期型 > 0 AND 日期个数 > 1 THEN 1 ELSE 0 END) AS 其中含多个日期,
       SUM(CASE WHEN 供应商个数 > 1 THEN 1 ELSE 0 END) AS 其中含多个供应商,
       SUM(CASE WHEN 有无批号 > 0 AND 有批号 > 0 THEN 1 ELSE 0 END) AS 其中有无批号与有批号混存,
       SUM(CASE WHEN 有金蝶批号 > 0 THEN 1 ELSE 0 END) AS 其中含金蝶TL批号,
       SUM(CASE WHEN 有PC0000 > 0 THEN 1 ELSE 0 END) AS 其中含PC0000
FROM (
  SELECT k.wzdm, k.ckdm, COUNT(*) AS 行数,
         COUNT(DISTINCT CASE WHEN k.lot_no LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                             THEN RIGHT(k.lot_no, 8) END) AS 日期个数,
         COUNT(DISTINCT CASE WHEN k.lot_no LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                             THEN LEFT(k.lot_no, LEN(k.lot_no) - 9) END) AS 供应商个数,
         SUM(CASE WHEN k.lot_no IS NULL OR LTRIM(RTRIM(k.lot_no)) = '' THEN 1 ELSE 0 END) AS 有无批号,
         SUM(CASE WHEN k.lot_no IS NOT NULL AND LTRIM(RTRIM(k.lot_no)) <> '' THEN 1 ELSE 0 END) AS 有批号,
         SUM(CASE WHEN k.lot_no LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' THEN 1 ELSE 0 END) AS 有日期型,
         SUM(CASE WHEN k.lot_no LIKE N'TL%' THEN 1 ELSE 0 END) AS 有金蝶批号,
         SUM(CASE WHEN k.lot_no = N'PC0000' THEN 1 ELSE 0 END) AS 有PC0000
  FROM kucun k GROUP BY k.wzdm, k.ckdm
) t GROUP BY CASE WHEN 行数 = 1 THEN N'1 行(不拆)' ELSE N'多行' END;
GO
-- ② 实例:挑“含多个日期型批号”的组,把每个批号的来源单据与日期列出来
SELECT N'实例:同仓同存货、不同日期的批号' AS k, k.wzdm, k.ckdm, k.lot_no AS 批号, k.yl AS 现存量,
       i.单据类型, i.单据编号, i.往来单位, CONVERT(nvarchar(10), i.单据日期, 120) AS 单据日期
FROM kucun k
OUTER APPLY (SELECT TOP 1 单据类型, 单据编号, 往来单位, 单据日期 FROM inh x
              WHERE x.物料编码 = k.wzdm AND x.仓库编码 = k.ckdm AND ISNULL(x.批号, N'') = ISNULL(k.lot_no, N'')
                AND ISNULL(x.asp_cancel,'N') <> 'Y' ORDER BY x.id) i
WHERE (k.wzdm + '|' + k.ckdm) IN (
  SELECT TOP 3 wzdm + '|' + ckdm FROM (
    SELECT wzdm, ckdm, COUNT(DISTINCT RIGHT(lot_no, 8)) AS d FROM kucun
    WHERE lot_no LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' GROUP BY wzdm, ckdm) z
  WHERE d >= 2 ORDER BY d DESC)
ORDER BY k.wzdm, k.ckdm, k.lot_no;
GO
-- ③ 实例:含「无批号 + 有批号」混存的组(期初 vs 业务批次)
SELECT N'实例:无批号与有批号混存' AS k, k.wzdm, k.ckdm, ISNULL(k.lot_no, N'(无批号)') AS 批号,
       k.rkl AS 累计入, k.ckl AS 累计出, k.yl AS 现存量, k.asp_user1 AS 来源
FROM kucun k
WHERE (k.wzdm + '|' + k.ckdm) IN (
  SELECT TOP 3 wzdm + '|' + ckdm FROM kucun GROUP BY wzdm, ckdm
  HAVING SUM(CASE WHEN lot_no IS NULL OR LTRIM(RTRIM(lot_no)) = '' THEN 1 ELSE 0 END) > 0
     AND SUM(CASE WHEN lot_no IS NOT NULL AND LTRIM(RTRIM(lot_no)) <> '' THEN 1 ELSE 0 END) > 0
  ORDER BY COUNT(*) DESC)
ORDER BY k.wzdm, k.ckdm, k.lot_no;
GO
