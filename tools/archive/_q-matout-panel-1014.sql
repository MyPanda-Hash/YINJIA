SET NOCOUNT ON;
SELECT N'--- yj_panel: MATERIAL_OUT ---' AS s;
SELECT * FROM yj_panel WHERE panel_code='MATERIAL_OUT';

SELECT N'--- yj_panel 列 ---' AS s;
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_panel') ORDER BY c.column_id;

SELECT N'--- 业务类型 字段行(全列) ---' AS s;
SELECT * FROM yj_field WHERE panel_code='MATERIAL_OUT' AND label IN (N'业务类型', N'仓库', N'批号', N'材料编码');
