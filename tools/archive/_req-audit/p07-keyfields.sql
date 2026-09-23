SET NOCOUNT ON;
PRINT N'=== 关键面板表头字段(place=header) ===';
SELECT panel_code, seq, col_name, label, data_type,
       LEFT(ISNULL(dict_sql,N''), 90) AS dict_head, ISNULL(ref_panel,N'') AS refp, ISNULL(ref_field,N'') AS reff, editable, required, hidden
FROM yj_field
WHERE panel_code IN ('RD_PROD_INFO','RD_SPEC_DOC','RD_ASM_PROC','RD_INSP_PLAN','RD_DOM_TEST','RD_APPROVAL','RD_PLAN','RD_PROGRESS')
  AND place LIKE '%header%'
ORDER BY panel_code, seq;
GO
PRINT N'=== 关键面板明细字段(place=detail) ===';
SELECT panel_code, seq, col_name, label, data_type,
       LEFT(ISNULL(dict_sql,N''), 90) AS dict_head, ISNULL(ref_panel,N'') AS refp, editable, hidden
FROM yj_field
WHERE panel_code IN ('RD_PROD_INFO','RD_SPEC_DOC','RD_ASM_PROC','RD_INSP_PLAN','RD_DOM_TEST')
  AND place LIKE '%detail%'
ORDER BY panel_code, seq;
GO
PRINT N'=== 检验频率/检验项目/项目定级/等级 相关字段(dict 原文) ===';
SELECT panel_code, col_name, label, data_type, dict_sql FROM yj_field
WHERE label IN (N'检验频率', N'检验项目', N'项目定级', N'项目层级', N'频率', N'检验类型', N'半成品处理', N'成品处理', N'文件编码', N'文件等级', N'等级')
ORDER BY panel_code, label;
GO
PRINT N'=== 文件编码/受控/履历/公差 字段(全库, 含 col_name) ===';
SELECT panel_code, col_name, label, place, seq FROM yj_field
WHERE col_name LIKE N'%文件编码%' OR col_name LIKE N'%受控%' OR col_name LIKE N'%履历%' OR col_name LIKE N'%公差%'
   OR label LIKE N'%文件编码%' OR label LIKE N'%受控%' OR label LIKE N'%履历%';
GO
PRINT N'=== 变更/终止/会签 相关字段(全库) ===';
SELECT panel_code, col_name, label, place, seq, LEFT(ISNULL(dict_sql,N''),80) AS dict_head FROM yj_field
WHERE col_name LIKE N'%变更%' OR label LIKE N'%变更%' OR col_name LIKE N'%终止%' OR col_name LIKE N'%会签%' OR label LIKE N'%会签%'
ORDER BY panel_code, place, seq;
