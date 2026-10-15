-- q-05-lot-origin.sql — 「同一仓+同一存货多行」到底由什么造成:批号形态 × 来源 × 是否同日期
SET NOCOUNT ON;
-- ① kucun 里批号的形态分类(供应商-日期型 / 金蝶TL型 / PC0000 / 纯数字 / 无批号)
SELECT N'批号形态(kucun)' AS k,
       CASE WHEN lot_no IS NULL OR LTRIM(RTRIM(lot_no)) = '' THEN N'① 无批号(期初导入)'
            WHEN lot_no = N'PC0000' THEN N'② PC0000(旧账/导入默认批号)'
            WHEN lot_no LIKE N'TL%' THEN N'③ 金蝶批号 TL*'
            WHEN lot_no LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' THEN N'④ 供应商-日期型(本系统生成)'
            ELSE N'⑤ 其它' END AS 形态,
       COUNT(*) AS 库存行数, COUNT(DISTINCT wzdm) AS 物料数, CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) AS 现存量
FROM kucun GROUP BY CASE WHEN lot_no IS NULL OR LTRIM(RTRIM(lot_no)) = '' THEN N'① 无批号(期初导入)'
            WHEN lot_no = N'PC0000' THEN N'② PC0000(旧账/导入默认批号)'
            WHEN lot_no LIKE N'TL%' THEN N'③ 金蝶批号 TL*'
            WHEN lot_no LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' THEN N'④ 供应商-日期型(本系统生成)'
            ELSE N'⑤ 其它' END ORDER BY 形态;
GO
-- ② 供应商-日期型批号:同一物料在同一仓库里,是否**同一天不同供应商**(⇒ 不同批号)造成的多行?
SELECT N'④型的组成' AS k,
       COUNT(*) AS 批号数,
       SUM(CASE WHEN 日期个数 > 1 THEN 1 ELSE 0 END) AS 同仓同物料跨日期的批号组,
       SUM(CASE WHEN 供应商个数 > 1 THEN 1 ELSE 0 END) AS 同仓同物料跨供应商的批号组
FROM (
  SELECT k.wzdm, k.ckdm, k.lot_no,
         COUNT(DISTINCT RIGHT(k.lot_no, 8)) AS 日期个数,
         COUNT(DISTINCT ISNULL(i.往来单位, N'')) AS 供应商个数
  FROM kucun k
  OUTER APPLY (SELECT TOP 1 往来单位 FROM inh x WHERE x.物料编码 = k.wzdm AND x.仓库编码 = k.ckdm
                 AND ISNULL(x.批号, N'') = ISNULL(k.lot_no, N'') AND ISNULL(x.asp_cancel,'N') <> 'Y' ORDER BY x.id) i
  WHERE k.lot_no LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
  GROUP BY k.wzdm, k.ckdm, k.lot_no
) t;
GO
-- ③ 实例:同一物料在同一仓的多行,每行的批号 + 该批的来源单据/供应商/日期
SELECT N'实例(多行拆解)' AS k, k.wzdm, k.ckdm, ISNULL(k.lot_no, N'(无批号)') AS 批号, k.yl AS 现存量,
       i.单据类型, i.单据编号, i.往来单位, CONVERT(nvarchar(10), i.单据日期, 120) AS 单据日期
FROM kucun k
OUTER APPLY (SELECT TOP 1 单据类型, 单据编号, 往来单位, 单据日期 FROM inh x
              WHERE x.物料编码 = k.wzdm AND x.仓库编码 = k.ckdm AND ISNULL(x.批号, N'') = ISNULL(k.lot_no, N'')
                AND ISNULL(x.asp_cancel,'N') <> 'Y' ORDER BY x.id) i
WHERE (k.wzdm + '|' + k.ckdm) IN (
  SELECT TOP 2 wzdm + '|' + ckdm FROM kucun WHERE lot_no LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
  GROUP BY wzdm, ckdm HAVING COUNT(*) >= 3 ORDER BY COUNT(*) DESC)
ORDER BY k.wzdm, k.ckdm, k.lot_no;
GO
