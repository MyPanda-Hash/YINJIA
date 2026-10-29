SET NOCOUNT ON;
SELECT COUNT(*) AS 行,
       SUM(CASE WHEN 经手人 IS NULL OR LTRIM(RTRIM(经手人)) = '' THEN 1 ELSE 0 END) AS 经手人空,
       SUM(CASE WHEN 成本单价 IS NULL THEN 1 ELSE 0 END) AS 成本单价空,
       SUM(CASE WHEN 成本金额 IS NULL THEN 1 ELSE 0 END) AS 成本金额空,
       SUM(CASE WHEN asp_user3 IS NULL OR LTRIM(RTRIM(asp_user3)) = '' THEN 1 ELSE 0 END) AS 审核人空,
       SUM(CASE WHEN asp_time3 IS NULL THEN 1 ELSE 0 END) AS 审核时间空,
       SUM(CASE WHEN 规格型号 IS NULL OR LTRIM(RTRIM(规格型号)) = '' THEN 1 ELSE 0 END) AS 规格空,
       SUM(CASE WHEN 批号 IS NULL OR LTRIM(RTRIM(批号)) = '' THEN 1 ELSE 0 END) AS 批号空
  FROM dbo.v_prod_pick_list;
