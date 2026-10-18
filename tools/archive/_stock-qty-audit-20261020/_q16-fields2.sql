SET NOCOUNT ON;
PRINT N'== 各库存面板里"数量类"字段(可见,按面板) ==';
SELECT panel_code, col_name, label, data_type, place, seq, visible, hidden
FROM yj_field
WHERE panel_code IN ('STOCK_BALANCE','STOCK_DETAIL','STOCK_STATUS','STOCK_PICK','STOCKTAKE','TRANSFER',
      'PURCHASE_IN','SALE_OUT','MATERIAL_OUT','FINISH_IN','OTHER_IN','OTHER_OUT','OUTSOURCE_IN')
  AND (label LIKE N'%数量%' OR label LIKE N'%量%' OR label LIKE N'%结存%' OR label LIKE N'%存量%')
  AND ISNULL(visible,1)=1 AND ISNULL(hidden,0)=0
ORDER BY panel_code, seq;

PRINT N'== 负现存量汇总(两套口径) ==';
SELECT CAST(SUM(CASE WHEN 现存量<0 THEN 现存量 ELSE 0 END) AS decimal(18,4)) AS 报表负合计,
       COUNT(CASE WHEN 现存量<0 THEN 1 END) AS 报表负行
FROM dbo.v_stock_balance;
SELECT CAST(SUM(CASE WHEN yl<0 THEN yl ELSE 0 END) AS decimal(18,4)) AS 台账负合计,
       COUNT(CASE WHEN yl<0 THEN 1 END) AS 台账负行
FROM dbo.kucun;
