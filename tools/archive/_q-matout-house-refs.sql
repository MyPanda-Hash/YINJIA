SET NOCOUNT ON;
SELECT panel_code, col_name, label, data_type, ISNULL(ref_panel,'') AS ref_panel, ISNULL(ref_field,'') AS ref_field, ISNULL(display_field,'') AS display_field, place, seq, required
FROM yj_field
WHERE panel_code IN ('FINISH_IN','OTHER_OUT','SALE_OUT','OUTSOURCE_ISSUE')
  AND (col_name LIKE N'%单位%' OR col_name LIKE N'%车间%' OR col_name LIKE N'%批%' OR col_name LIKE N'%仓库%' OR col_name LIKE N'%存货%' OR col_name LIKE N'%材料%')
ORDER BY panel_code, place, seq;
GO
SELECT panel_code, col_name, label, data_type, ISNULL(ref_panel,'') AS ref_panel, ISNULL(ref_field,'') AS ref_field, place, seq
FROM yj_field WHERE data_type=N'参照' AND (col_name LIKE N'%单位%' OR col_name LIKE N'%车间%')
ORDER BY panel_code, seq;
GO
SELECT panel_code, panel_name, mode, ISNULL(head_table,'') AS h, ISNULL(line_table,'') AS l FROM yj_panel WHERE panel_code IN ('DEPT','EMP','WH','INV','UOM','BD_UOM','PROJ','MANU_ORDER','WO_ORDER') ORDER BY panel_code;
GO
