SET NOCOUNT ON;
PRINT '=== 1. QC_INSP 送检/检验单 字段 ===';
SELECT TOP 45 col_name, label, data_type, editable, required, visible, dict_sql FROM yj_field WHERE panel_code='QC_INSP' ORDER BY seq, col_name;
GO
PRINT '=== 2. QC_INSP 检验结果/批次 专项 ===';
SELECT col_name, label, data_type, dict_sql FROM yj_field WHERE panel_code='QC_INSP' AND (label LIKE N'%结果%' OR label LIKE N'%批%' OR label LIKE N'%数量%' OR label LIKE N'%暂收%' OR label LIKE N'%价%');
GO
PRINT '=== 3. bs_inv 含"库位"的列 ===';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('bs_inv','bud_inv','bs_material','dm_gf','bs_wh') AND (COLUMN_NAME LIKE N'%库位%' OR COLUMN_NAME LIKE N'%货位%' OR COLUMN_NAME LIKE N'%仓位%');
GO
PRINT '=== 4. 全库任何表含"预设库位"列 ===';
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME LIKE N'%预设库位%' OR COLUMN_NAME LIKE N'%预设%';
GO
PRINT '=== 5. 含 库位 的列(限重要表) ===';
SELECT TOP 30 TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME LIKE N'%库位%' ORDER BY TABLE_NAME;
GO
PRINT '=== 6. 用户表结构/用户类型 ===';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME LIKE 'yj_user%' OR TABLE_NAME LIKE '%role%' ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
PRINT '=== 7. 角色清单 ===';
SELECT role_code, role_name, remark, is_admin FROM yj_role;
GO
PRINT '=== 8. 研发管理面板字段数 ===';
SELECT p.panel_code, p.panel_name, COUNT(f.id) AS field_cnt FROM yj_panel p LEFT JOIN yj_field f ON f.panel_code=p.panel_code WHERE p.module_group=N'研发管理' GROUP BY p.panel_code, p.panel_name ORDER BY p.panel_code;
GO
PRINT '=== 9. 研发面板的表头状态/审核字段 ===';
SELECT panel_code, col_name, label, data_type, dict_sql FROM yj_field WHERE panel_code LIKE 'RD_%' AND (label LIKE N'%状态%' OR label LIKE N'%审核%' OR label LIKE N'%受控%' OR label LIKE N'%定级%' OR label LIKE N'%等级%' OR label LIKE N'%编码%' OR label LIKE N'%频率%' OR label LIKE N'%版本%') ORDER BY panel_code, label;
