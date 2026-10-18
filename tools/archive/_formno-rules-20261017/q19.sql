SET NOCOUNT ON;
SELECT DB_NAME() AS db, panel_code, panel_name, prefix AS 当前前缀 FROM yj_panel WHERE panel_code = N'MATERIAL_OUT';
SELECT COUNT(*) AS ll_新格式号数 FROM s_allno WHERE dh LIKE N'LL-[0-9][0-9][0-9][0-9]-[0-9][0-9]-%';
SELECT N'CL-' AS pf, COUNT(*) AS n FROM bd_material_out WHERE 单据编号 LIKE N'CL-%' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'SCLL-', COUNT(*) FROM bd_material_out WHERE 单据编号 LIKE N'SCLL-%' AND ISNULL(asp_cancel,'N')<>'Y';
SELECT COUNT(*) AS 其它也用LL的面板数 FROM yj_panel WHERE ISNULL(prefix,N'') = N'LL' AND panel_code <> N'MATERIAL_OUT';
