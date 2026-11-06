SET NOCOUNT ON;
-- 子件编码在存货档案里的计量单位(全量,去重)
SELECT i.存货编码, i.计量单位, COUNT(*) AS cnt
  FROM dbo.bs_inv i
 WHERE i.存货编码 IN (SELECT DISTINCT 子件编码 FROM dbo.bs_asm_bom WHERE 来源 = N'金蝶BOM引出列表_20261019174847')
 GROUP BY i.存货编码, i.计量单位
 ORDER BY i.存货编码, i.计量单位;
GO
