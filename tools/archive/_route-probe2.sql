-- 工艺路线(ROUTE)现状取证 ② 字段行 + 引用关系
SELECT '=== 3. ROUTE 字段明细 ===' AS x;
SELECT f.seq, f.col_name, f.label, f.data_type, f.place, f.visible, f.hidden, f.editable, f.required,
       f.ref_panel, f.ref_field, f.width, f.col_group
FROM yj_field f WHERE f.panel_code = 'ROUTE' ORDER BY f.place, f.seq, f.id;
GO
SELECT '=== 4. 引自 ROUTE 的其它面板字段 ===' AS x;
SELECT panel_code, seq, label, place, ref_panel, ref_field FROM yj_field WHERE ref_panel = 'ROUTE' ORDER BY panel_code, seq;
GO
SELECT '=== 5. 生产基础资料面板一览 ===' AS x;
SELECT panel_code, panel_name, mode, head_table, line_table, code_col, detail_key
FROM yj_panel WHERE panel_code IN ('OP','WORK_CENTER','TEAM','EQUIP','ROUTE','PROCESS','MATGRP','MAT');
GO
SELECT '=== 6. 引用 bs_route 的库对象 ===' AS x;
SELECT name, type_desc FROM sys.objects WHERE OBJECT_DEFINITION(object_id) LIKE '%bs_route%' AND type IN ('V','P','FN','TF','IF');
GO
SELECT '=== 7. ROUTE 面板译名条数 ===' AS x;
SELECT scope, locale, text FROM yj_translation WHERE ref_key = N'工艺路线' ORDER BY scope, locale;
