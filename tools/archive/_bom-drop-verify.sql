-- BOM单下架终检(两账套):面板/字段/表/译名应全部为 0/不存在
SELECT '=== 1. 面板与字段 ===' AS x;
SELECT (SELECT COUNT(*) FROM yj_panel WHERE panel_code = 'BOM_KD') AS 面板行,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BOM_KD') AS 字段行;
GO
SELECT '=== 2. 表是否存在 ===' AS x;
SELECT OBJECT_ID(N'dbo.bs_bom_head') AS bs_bom_head, OBJECT_ID(N'dbo.bs_bom_detail') AS bs_bom_detail;
GO
SELECT '=== 3. 译名残留(panel BOM单 / 本功能新增标签) ===' AS x;
SELECT COUNT(*) AS BOM单面板译名 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'BOM单';
SELECT ref_key FROM yj_translation WHERE scope = 'field' AND ref_key IN
 (N'成品率', N'BOM备注', N'审核状态', N'是否启用', N'产品单位', N'材料用量', N'发料方式', N'子料编码', N'物料备注', N'行号');
GO
SELECT '=== 4. 旧「物料清单」面板未被动过 ===' AS x;
SELECT panel_code, panel_name, mode, line_table, (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code) AS 字段数
FROM yj_panel p WHERE p.panel_code IN ('BOM', 'WLBOM', 'RD_ASM_BOM');
SELECT 'bs_bom 行数' AS t, COUNT(*) AS n FROM bs_bom;
