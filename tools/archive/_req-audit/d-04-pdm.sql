SET NOCOUNT ON;
-- d-04 PDM/研发侧 9.18 需求落点(P1-P18)
-- P1 文件汇总表 / P2 受控 / P3 文件编码 / P8 履历 / P10 检验规范 / P12 四级 / P15 进度表 / P16 变更申请单 / P17 公差
SELECT panel_code, panel_name, module_group, mode
FROM yj_panel WHERE module_group = N'研发管理' OR panel_code LIKE N'RD[_]%'
ORDER BY panel_code;
GO
-- d-04b 研发面板字段里与 P1/P2/P3/P8/P10 相关的
SELECT panel_code, col_name, label, data_type, place, visible, hidden
FROM yj_field
WHERE (panel_code LIKE N'RD[_]%' OR panel_code IN (N'DOC_SUMMARY',N'DOC_CTRL'))
  AND (label LIKE N'%编码%' OR label LIKE N'%受控%' OR label LIKE N'%审核日期%' OR label LIKE N'%履历%'
       OR label LIKE N'%修订%' OR label LIKE N'%版本%' OR label LIKE N'%状态%' OR label LIKE N'%负责人%'
       OR label LIKE N'%等级%' OR label LIKE N'%定级%' OR label LIKE N'%频率%' OR label LIKE N'%管控%')
ORDER BY panel_code, seq;
GO
-- d-04c 研发管理面板里是否存在「等级」下拉与「四级」候选
SELECT panel_code, col_name, label, data_type, dict_sql
FROM yj_field
WHERE (label LIKE N'%等级%' OR label LIKE N'%定级%' OR label LIKE N'%级别%' OR label LIKE N'%密级%')
ORDER BY panel_code, label;
GO
-- d-04d 字典表里是否有四级/等级类候选
SELECT name FROM sys.tables WHERE name LIKE N'dm[_]%' ORDER BY name;
GO
-- d-04e 文件编码相关:研发面板是否有「文件编码」列
SELECT t.name AS 表名, c.name AS 列名 FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name LIKE N'rd[_]%' AND (c.name LIKE N'%编码%')
ORDER BY t.name, c.column_id;
GO
-- d-04f 项目终止流程相关表(P14)
SELECT name FROM sys.tables WHERE name LIKE N'%plan[_]term%' OR name LIKE N'%term%' ORDER BY name;
GO
SELECT state AS 状态, COUNT(*) AS 行数 FROM yj_plan_term GROUP BY state;
GO
-- d-04g 检验频率类字段(P10 每批/生产量/型式检验)
SELECT panel_code, col_name, label, data_type, dict_sql FROM yj_field
WHERE label LIKE N'%频率%' OR col_name LIKE N'%频率%' OR dict_sql LIKE N'%型式检验%' OR dict_sql LIKE N'%每批%';
GO
