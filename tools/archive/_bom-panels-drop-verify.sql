-- BOM 面板族下架终检:面板/字段/表/视图/译名;并确认未误删邻近对象
SELECT '=== 1. 已下架对象应为 0 / 不存在 ===' AS x;
SELECT (SELECT COUNT(*) FROM yj_panel WHERE panel_code IN ('BOM','WO_KIT')) AS 面板行,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code IN ('BOM','WO_KIT')) AS 字段行,
       OBJECT_ID(N'dbo.bs_bom') AS bs_bom, OBJECT_ID(N'dbo.v_wo_kit') AS v_wo_kit;
GO
SELECT '=== 2. 邻近对象未被动过 ===' AS x;
SELECT panel_code, panel_name, mode, line_table,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code) AS 字段数
FROM yj_panel p WHERE p.panel_code IN ('WLBOM','RD_ASM_BOM','ROUTE','INV') ORDER BY panel_code;
SELECT 'mate 行数' AS t, COUNT(*) AS n FROM mate;
GO
SELECT '=== 3. 面板名「物料清单」的译名应保留(WLBOM 还在用) ===' AS x;
SELECT COUNT(*) AS 物料清单面板译名条数 FROM yj_translation WHERE scope='panel' AND ref_key = N'物料清单';
SELECT COUNT(*) AS 残留字段译名 FROM yj_translation WHERE scope='field' AND ref_key IN
 (N'子件编码', N'父件编码', N'定额数量', N'物料清单编码', N'齐套缺口', N'单件用量');
GO
SELECT '=== 4. 全库是否还有引用 bs_bom 的对象 ===' AS x;
SELECT o.name, o.type_desc FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE '%bs_bom%';
