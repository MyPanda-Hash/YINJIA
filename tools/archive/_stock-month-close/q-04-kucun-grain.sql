-- q-04-kucun-grain.sql — 回答「同仓库 + 同存货编码为什么被拆成多行」:粒度是**三键**(物料,仓库,批号)
SET NOCOUNT ON;
-- ① 粒度自证:三键唯一、两键不唯一
SELECT N'粒度对照' AS k,
       (SELECT COUNT(*) FROM kucun) AS 行数,
       (SELECT COUNT(*) FROM (SELECT wzdm, ckdm FROM kucun GROUP BY wzdm, ckdm) t) AS 物料加仓库两键组合数,
       (SELECT COUNT(*) FROM (SELECT wzdm, ckdm, lot_no FROM kucun GROUP BY wzdm, ckdm, lot_no) t) AS 三键组合数;
GO
-- ② 批号分布(哪来的批号)
SELECT N'批号取值分布' AS k, ISNULL(批号, N'(无批号)') AS 批号, COUNT(*) AS 行数,
       COUNT(DISTINCT 物料编码) AS 物料数, COUNT(DISTINCT 仓库编码) AS 仓库数,
       CAST(SUM(数量) AS decimal(18,4)) AS 流水净额
FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y'
GROUP BY ISNULL(批号, N'(无批号)') ORDER BY 行数 DESC;
GO
-- ③ 被拆得最多的 (仓库,存货) —— 直接看它们的几行差在哪(只有批号不同)
SELECT N'拆分行数分布' AS k, 行数 AS 同一仓同存货的行数, COUNT(*) AS 有多少组
FROM (SELECT wzdm, ckdm, COUNT(*) AS 行数 FROM kucun GROUP BY wzdm, ckdm) t
GROUP BY 行数 ORDER BY 行数;
GO
SELECT N'样本:同一仓同存货的多行(前 3 组 × 各行)' AS k, wzdm, ckdm, lot_no, rkl, ckl, yl, asp_user1,
       CONVERT(nvarchar(19), update_date, 120) AS 更新时间
FROM kucun
WHERE (wzdm + '|' + ckdm) IN (
  SELECT TOP 3 wzdm + '|' + ckdm FROM kucun GROUP BY wzdm, ckdm
  ORDER BY COUNT(DISTINCT ISNULL(lot_no, N'')) DESC, COUNT(*) DESC)
ORDER BY wzdm, ckdm, lot_no;
GO
-- ④ 期初导入那批(无批号)与业务写入批号的对照
SELECT N'来源 × 有无批号' AS k, asp_user1,
       SUM(CASE WHEN lot_no IS NULL OR LTRIM(RTRIM(lot_no)) = '' THEN 1 ELSE 0 END) AS 无批号行,
       SUM(CASE WHEN lot_no IS NOT NULL AND LTRIM(RTRIM(lot_no)) <> '' THEN 1 ELSE 0 END) AS 有批号行
FROM kucun GROUP BY asp_user1;
GO
