SET NOCOUNT ON;
SELECT name, compatibility_level, collation_name FROM sys.databases WHERE name IN (N'HSDZ_MES', N'HSDZ_MES_TEST');
SELECT OBJECT_ID(N'dbo.v_prod_pick_list') AS view_exists, OBJECT_ID(N'dbo.v_wo_mixing_list') AS mix_view;
SELECT COUNT(*) AS panels_named FROM dbo.yj_panel WHERE panel_code = N'PROD_PICK_LIST' OR panel_name = N'生产领料';
