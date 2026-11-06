-- ============================================================================
-- CHECK-before:组装物料清单(ASM_BOM)表头可维护 · 迁移前只读取证(2026-11-04)
--
-- 用途:在服务器/开发机执行迁移**之前**跑一遍,证明「表头 11 个字段全部只读」的报障现场,
--       并记录字段/面板/物理表/config 的改前基线,便于迁移后对照。
-- 只读:全部是 SELECT,不写任何表。
-- 用法(在 tools 目录;Q.java 为只读查询器,按 GO 分批执行并打印结果集):
--   java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_1019-questions\Q.java HSDZ_MES archive\_asm-bom-maintainable-verify-20261104\CHECK-before.sql
--   java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_1019-questions\Q.java HSDZ_MES_TEST archive\_asm-bom-maintainable-verify-20261104\CHECK-before.sql
--   也可贴进 SSMS 查询窗口逐段执行。
-- ============================================================================
SET NOCOUNT ON;
GO

-- 0. 环境
SELECT DB_NAME() AS db_name, @@SERVERNAME AS server_name, SUSER_SNAME() AS login_name,
       CONVERT(varchar(19), GETDATE(), 120) AS run_at,
       N'CHECK-before' AS purpose;
GO

-- 1. 面板行(yj_panel):单表 doc 模式;改前 config 应为 NULL(或至少不含 headDefaults)
SELECT panel_code, panel_name, panel_name_en, category, mode, line_table,
       ISNULL(head_table, N'<NULL>') AS head_table, group_col, pk_col, code_col, prefix,
       ISNULL(date_col, N'<NULL>') AS date_col, page_size, detail_key, module_group,
       ISNULL(config, N'<NULL>') AS config
  FROM yj_panel WHERE panel_code = 'ASM_BOM';
GO

-- 2. 19 个字段全量(改前基线;editable 全部应为 0 / 明细 7 个为 1)
SELECT id, label, col_name, place, data_type, seq, width, editable, required, hidden, visible,
       ISNULL(ref_panel, N'') AS ref_panel, ISNULL(ref_field, N'') AS ref_field,
       ISNULL(display_field, N'') AS display_field, ISNULL(dict_sql, N'') AS dict_sql
  FROM yj_field WHERE panel_code = 'ASM_BOM' ORDER BY seq, id;
GO

-- 3. 按 place 分组的 editable 分布(改前期望:表头 11 个 = editable 0)
SELECT place, editable, COUNT(*) AS cnt
  FROM yj_field WHERE panel_code = 'ASM_BOM'
 GROUP BY place, editable ORDER BY place, editable;
GO

-- 4. 表头字段清单 + 条数(改前期望 hdr_editable_1 = 0、hdr_editable_0 = 11)
SELECT label, place, data_type, editable
  FROM yj_field
 WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%'
 ORDER BY seq, id;
GO
SELECT DB_NAME() AS db_name,
       COUNT(*) AS hdr_fields,
       SUM(CASE WHEN editable = 1 THEN 1 ELSE 0 END) AS hdr_editable_1,
       SUM(CASE WHEN editable = 0 THEN 1 ELSE 0 END) AS hdr_editable_0
  FROM yj_field
 WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%';
GO

-- 5. 选料参照现状(改前期望:产品编码/子件编码 都是「文本」,参照字段 0 个)
SELECT label, place, data_type, ISNULL(ref_panel, N'') AS ref_panel,
       ISNULL(ref_field, N'') AS ref_field, ISNULL(display_field, N'') AS display_field
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND label IN (N'产品编码', N'子件编码')
 ORDER BY seq;
GO
SELECT DB_NAME() AS db_name,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND data_type = N'参照') AS ref_fields_total;
GO

-- 6. 默认BOM 现状(改前期望:data_type=文本、dict_sql 空、editable=0)
SELECT label, data_type, ISNULL(dict_sql, N'') AS dict_sql, editable
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'默认BOM';
GO

-- 7. 规模基线:面板字段 19、物理表 47 列;**本迁移脚本是否已登记**(改前期望 0)
SELECT DB_NAME() AS db_name,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM') AS panel_fields,
       (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom')) AS asm_bom_cols,
       (SELECT COUNT(*) FROM yj_schema_log WHERE script_name = N'migrate-asm-bom-maintainable-20261104.sql') AS script_logged;
GO

-- 7b. 数据影响面(只读;迁移只改元数据,业务数据不动 —— 这里留改前基线供报告/对照)
--     单据数 = COUNT(DISTINCT 单据编号);行数含已作废行;默认BOM/状态 分布来自金蝶导入口径。
SELECT DB_NAME() AS db_name,
       COUNT(*) AS rows_total,
       SUM(CASE WHEN ISNULL(asp_cancel, N'N') <> N'Y' THEN 1 ELSE 0 END) AS rows_live,
       COUNT(DISTINCT [单据编号]) AS docs_total
  FROM dbo.bs_asm_bom;
GO
SELECT N'默认BOM 分布' AS what, ISNULL([默认BOM], N'<NULL>') AS val, COUNT(*) AS cnt
  FROM dbo.bs_asm_bom GROUP BY ISNULL([默认BOM], N'<NULL>') ORDER BY cnt DESC, val;
GO
SELECT N'状态 分布' AS what, ISNULL([状态], N'<NULL>') AS val, COUNT(*) AS cnt
  FROM dbo.bs_asm_bom GROUP BY ISNULL([状态], N'<NULL>') ORDER BY cnt DESC, val;
GO
-- 关键列可空性(说明:产品编码/工序/子件编码 均 NOT NULL;空白草稿建单由后端
--   insertRow 的 fillRequiredDefaults 给 NOT NULL 无默认值列补 ''/0,不需要改表结构)
SELECT c.name AS col, t.name AS typ, c.is_nullable, c.max_length
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.bs_asm_bom')
   AND c.name IN (N'单据编号', N'产品编码', N'工序', N'子件编码', N'行序', N'默认BOM', N'状态')
 ORDER BY c.column_id;
GO

-- 8. 结论:BEFORE-STATE 判定(表头确实全只读 ⇒ 与 2026-11-04 报障现场一致,可执行迁移)
DECLARE @hdrOn int, @hdrOff int, @fields int, @cols int, @refs int, @cfg nvarchar(max);
SELECT @hdrOn  = COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 1;
SELECT @hdrOff = COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 0;
SELECT @fields = COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM';
SELECT @cols   = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom');
SELECT @refs   = COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND data_type = N'参照';
SELECT @cfg = config FROM yj_panel WHERE panel_code = 'ASM_BOM';
SELECT DB_NAME() AS db_name,
       @hdrOn AS hdr_editable_1, @hdrOff AS hdr_editable_0, @fields AS panel_fields,
       @cols AS asm_bom_cols, @refs AS ref_fields,
       ISNULL(@cfg, N'<NULL>') AS config,
       CASE WHEN @hdrOn = 0 AND @hdrOff = 11 AND @fields = 19 AND @cols = 47 AND @refs = 0
            THEN N'BEFORE-STATE PASS:表头 11 个字段全只读(与 2026-11-04 报障现场一致),可执行迁移'
            ELSE N'注意:现状与「表头全只读」不符(可能已执行过迁移或被手改),先逐项核对再决定'
       END AS before_verdict;
GO
