SET NOCOUNT ON;
-- 表结构:列数
SELECT COUNT(*) AS col_count FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom');
GO
-- 索引清单
SELECT name AS index_name, type_desc, is_unique, has_filter, ISNULL(filter_definition, N'') AS filter_definition
  FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_asm_bom') AND type > 0
 ORDER BY name;
GO
-- 列清单
SELECT name AS col_name, TYPE_NAME(user_type_id) AS type_name, max_length, precision, scale, is_nullable, column_id
  FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom')
 ORDER BY column_id;
GO
-- 面板元数据
SELECT panel_code, panel_name, category, mode, line_table, head_table, pk_col, code_col, prefix, date_col
  FROM yj_panel WHERE panel_code = 'ASM_BOM';
GO
SELECT COUNT(*) AS field_count FROM yj_field WHERE panel_code = 'ASM_BOM';
GO
SELECT id, label, col_name, data_type, place, seq, visible, hidden, editable, ref_panel, ref_field
  FROM yj_field WHERE panel_code = 'ASM_BOM'
 ORDER BY seq, id;
GO
-- schema log
SELECT script_name, content_hash, applied_at
  FROM yj_schema_log
 WHERE script_name IN ('migrate-asm-bom-data-20261030.sql','migrate-asm-bom-data-full-20261105.sql')
 ORDER BY script_name;
GO
-- 全表行数(按来源分组)
SELECT ISNULL(来源, N'<NULL>') AS src, COUNT(*) AS rows_cnt, COUNT(DISTINCT 单据编号) AS docs_cnt
  FROM dbo.bs_asm_bom GROUP BY 来源 ORDER BY 来源;
GO
