SET NOCOUNT ON;
SELECT panel_code, COUNT(*) AS 混杂标签数,
       SUM(CASE WHEN hidden=0 THEN 1 ELSE 0 END) AS 其中可见
FROM yj_field
WHERE panel_code IN ('MATERIAL_OUT','PURCHASE_IN','SALE_OUT','PU_ORDER','FINISH_IN','OTHER_OUT','OUTSOURCE_ISSUE')
  AND (label LIKE N'%[_]%' OR label LIKE N'%[a-zA-Z]%')
GROUP BY panel_code ORDER BY 混杂标签数 DESC;
GO
SELECT panel_code, label FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND hidden=0 AND (label LIKE N'%[_]%' OR label LIKE N'%[a-zA-Z]%')
ORDER BY panel_code, seq;
GO
