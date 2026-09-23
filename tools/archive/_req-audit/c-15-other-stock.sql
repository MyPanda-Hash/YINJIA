SET NOCOUNT ON;
-- 其他入库/其他出库/库存三报表/采购入库 字段清单(每面板一行)
SELECT f.panel_code AS 面板,
       STUFF((SELECT N' || ' + g.col_name + N'(' + g.label + N')[' + ISNULL(g.place,N'-') + N',e' + CAST(g.editable AS varchar(2))
                     + N',r' + CAST(g.required AS varchar(2)) + N',h' + CAST(g.hidden AS varchar(2))
                     + CASE WHEN g.ref_panel IS NOT NULL AND LTRIM(RTRIM(g.ref_panel)) <> N'' THEN N',ref=' + g.ref_panel ELSE N'' END
                     + CASE WHEN g.dict_sql IS NOT NULL AND LTRIM(RTRIM(g.dict_sql)) <> N'' THEN N',DICT' ELSE N'' END + N']'
              FROM yj_field g WHERE g.panel_code = f.panel_code
              ORDER BY g.place, g.seq FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 4, N'') AS 字段清单
FROM (SELECT DISTINCT panel_code FROM yj_field
      WHERE panel_code IN ('OTHER_IN','OTHER_OUT','STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','INV')) f
ORDER BY f.panel_code;
GO
-- 采购入库 头/行 关键字段(含转ERP/批次/源单)
SELECT place, col_name, label, hidden, visible, editable
FROM yj_field WHERE panel_code='PURCHASE_IN'
  AND (col_name LIKE N'%ERP%' OR col_name LIKE N'%批次%' OR col_name LIKE N'%源单%' OR col_name LIKE N'%采购订单%'
       OR col_name LIKE N'%是否来料检验%' OR col_name LIKE N'%仓库%')
ORDER BY place, seq;
GO
