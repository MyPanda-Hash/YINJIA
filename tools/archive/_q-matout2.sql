SET NOCOUNT ON;
SELECT panel_code, panel_name, mode, ISNULL(head_table,'') AS head_table, ISNULL(line_table,'') AS line_table, ISNULL(pk_col,'') AS pk FROM yj_panel WHERE panel_code='MATERIAL_OUT' OR line_table='bl_material_out' OR head_table='bd_material_out';
SELECT place, COUNT(*) AS n FROM yj_field WHERE panel_code='MATERIAL_OUT' GROUP BY place;
SELECT TOP 6 单据编号, 单据日期, 单据状态, 仓库, 加工单号, 来源单号 FROM bd_material_out ORDER BY id DESC;
