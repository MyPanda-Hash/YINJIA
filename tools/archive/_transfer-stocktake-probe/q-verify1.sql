SET NOCOUNT ON;
SELECT name FROM sys.objects WHERE name IN ('bd_transfer','bl_transfer','bd_stocktake','bl_stocktake','v_transfer_detail','v_transfer_stats','v_stocktake_detail','v_stocktake_stats','PATCH_X') ORDER BY name;
SELECT panel_code, panel_name, mode, line_table FROM yj_panel WHERE panel_code LIKE '%TRANSFER%' OR panel_code LIKE '%STOCKTAKE%' ORDER BY panel_code;
SELECT panel_code, COUNT(*) n FROM yj_field WHERE panel_code LIKE '%TRANSFER%' OR panel_code LIKE '%STOCKTAKE%' GROUP BY panel_code ORDER BY panel_code;
SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key IN (N'调拨单',N'盘点单',N'调出仓库',N'实盘数量',N'差异数量') ORDER BY ref_key, locale;
SELECT r.role_name, p.panel_code FROM yj_role_panel p JOIN yj_role r ON r.id=p.role_id WHERE p.panel_code LIKE 'TRANSFER%' OR p.panel_code LIKE 'STOCKTAKE%' ORDER BY p.panel_code, r.id;
