SET NOCOUNT ON;
/* jbbh 有没有被面板字段引用 */
SELECT panel_code, col_name, label, place, data_type FROM yj_field
WHERE col_name = N'jbbh' OR label = N'班别';

/* 有没有视图/存储过程引用了 scjl 的 jbbh */
SELECT o.name AS 对象, o.type_desc
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%jbbh%';

/* scjl 被哪些对象引用 */
SELECT o.name AS 对象, o.type_desc
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%scjl%';

/* scjl 在 yj_panel 里挂在哪些面板上 */
SELECT panel_code, panel_name, mode, head_table, line_table FROM yj_panel
WHERE line_table = N'scjl' OR head_table = N'scjl';
