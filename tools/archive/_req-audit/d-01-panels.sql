SET NOCOUNT ON;
-- d-01 面板总量与分组(核对 README 声称的 82 个面板)
SELECT COUNT(*) AS 面板总数 FROM yj_panel;
GO
SELECT module_group AS 模块分组, COUNT(*) AS 面板数 FROM yj_panel GROUP BY module_group ORDER BY 面板数 DESC;
GO
SELECT mode AS 模式, COUNT(*) AS 面板数 FROM yj_panel GROUP BY mode ORDER BY 面板数 DESC;
GO
-- d-01 9.18 关键词在「面板名」里的落点
SELECT panel_code, panel_name, module_group, mode, head_table, line_table
FROM yj_panel
WHERE panel_name LIKE N'%受控%' OR panel_name LIKE N'%变更%' OR panel_name LIKE N'%公差%'
   OR panel_name LIKE N'%特采%' OR panel_name LIKE N'%客供%' OR panel_name LIKE N'%四级%'
   OR panel_name LIKE N'%履历%' OR panel_name LIKE N'%检验规范%' OR panel_name LIKE N'%文件汇总%'
   OR panel_name LIKE N'%汇总表%' OR panel_name LIKE N'%预设%' OR panel_name LIKE N'%库位%'
   OR panel_name LIKE N'%标签%' OR panel_name LIKE N'%二维码%' OR panel_name LIKE N'%终止%'
   OR panel_name LIKE N'%供应商%' OR panel_name LIKE N'%其他入库%' OR panel_name LIKE N'%其他出库%'
   OR panel_name LIKE N'%检验单%' OR panel_name LIKE N'%检验结果%'
ORDER BY module_group, panel_code;
GO
-- d-01b 9.18 关键词在「字段标签」里的落点
SELECT panel_code, col_name, label, data_type, place, dict_sql, ref_panel, visible, hidden
FROM yj_field
WHERE label LIKE N'%受控%' OR label LIKE N'%变更%' OR label LIKE N'%公差%'
   OR label LIKE N'%特采%' OR label LIKE N'%客供%' OR label LIKE N'%四级%'
   OR label LIKE N'%履历%' OR label LIKE N'%检验规范%' OR label LIKE N'%文件汇总%'
   OR label LIKE N'%预设%' OR label LIKE N'%库位%' OR label LIKE N'%货位%'
   OR label LIKE N'%标签%' OR label LIKE N'%二维码%' OR label LIKE N'%检验结果%'
   OR label LIKE N'%文件编码%' OR label LIKE N'%受控章%' OR label LIKE N'%审核日期%'
ORDER BY panel_code, place, seq;
GO
-- d-01c 物理列级别的关键词落点(全库)
SELECT t.name AS 表名, c.name AS 列名, ty.name AS 类型, c.max_length AS 长度
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE c.name LIKE N'%受控%' OR c.name LIKE N'%变更%' OR c.name LIKE N'%公差%'
   OR c.name LIKE N'%特采%' OR c.name LIKE N'%客供%' OR c.name LIKE N'%四级%'
   OR c.name LIKE N'%履历%' OR c.name LIKE N'%检验规范%' OR c.name LIKE N'%文件汇总%'
   OR c.name LIKE N'%预设%' OR c.name LIKE N'%库位%' OR c.name LIKE N'%文件编码%'
ORDER BY t.name, c.column_id;
GO
-- d-01d 9.18 关键词在「译名表」里的落点(说明是否做过多语言)
SELECT scope, ref_key, locale, text, source
FROM yj_translation
WHERE ref_key LIKE N'%受控%' OR ref_key LIKE N'%变更申请%' OR ref_key LIKE N'%公差%'
   OR ref_key LIKE N'%特采%' OR ref_key LIKE N'%客供%' OR ref_key LIKE N'%四级%'
   OR ref_key LIKE N'%履历%' OR ref_key LIKE N'%检验规范%' OR ref_key LIKE N'%文件汇总%'
   OR ref_key LIKE N'%预设库位%' OR ref_key LIKE N'%模糊查询%'
ORDER BY ref_key, locale;
GO
