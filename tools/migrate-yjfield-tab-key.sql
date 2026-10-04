-- migrate-yjfield-tab-key.sql — yj_field 加 tab_key(字段所属明细页签),并回填来料检验要求的动态字段
--
-- 用户口径(2026-10-04):「检验数据要求的自定义字段,是单独针对每个表的」——
--   即:来料检验要求(QC_INSP_REQ)的**每张表(页签)各有各的自定义列**,
--   不是把所有自定义列堆在一张「自定义检验要求」表上。
--
-- 承载:动态字段(备用列池)住哪张表,是**字段的元数据**,故落在 yj_field.tab_key:
--   · 值 = 该面板页签名(来料检验要求 = 物料类别 的字典值,如 折叠棉 / 自定义检验要求);
--   · NULL = 不区分页签(其余所有面板保持原样,行为零变化)。
-- 注:没复用 col_group —— 那个是「父表头分组」(报表两级表头),档案面板配置也会读它生成
--     gridTabs.groups,拿它存页签会顺带造出一个假的父表头分组;tab_key 语义单一、互不干扰。
--
-- 回填:本改动之前绑定的动态字段一律归「自定义检验要求」页签 —— 那正是它们当时的显示位置
--   (旧实现把全部动态字段都渲染在那张表上),回填后行为完全一致。
-- 幂等:列已存在则跳过建列;回填只动 tab_key IS NULL 的行。
-- 两账套都要执行:
--   正式 java -cp lib\mssql-jdbc.jar DbSync.java run migrate-yjfield-tab-key.sql
--   测试 YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar DbSync.java run migrate-yjfield-tab-key.sql
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库时不得被切走)
GO
IF COL_LENGTH('dbo.yj_field', N'tab_key') IS NULL
BEGIN
  ALTER TABLE dbo.yj_field ADD [tab_key] nvarchar(50) NULL;
  PRINT N'[OK] yj_field.tab_key 已建(字段所属明细页签;NULL=不区分)';
END
ELSE PRINT N'[跳过] yj_field.tab_key 已存在';
GO
-- 列级中文注明(AGENTS.md 2026-09-14 起强制:新增列必须带注明)
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID('dbo.yj_field') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.yj_field'), 'tab_key', 'ColumnId')
                 AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'所属明细页签(分页签面板用:来料检验要求 QC_INSP_REQ 的字段=所属表/页签,值取 物料类别 字典值;NULL=不区分页签)',
       N'SCHEMA', N'dbo', N'TABLE', N'yj_field', N'COLUMN', N'tab_key';
ELSE
  EXEC sp_updateextendedproperty N'MS_Description',
       N'所属明细页签(分页签面板用:来料检验要求 QC_INSP_REQ 的字段=所属表/页签,值取 物料类别 字典值;NULL=不区分页签)',
       N'SCHEMA', N'dbo', N'TABLE', N'yj_field', N'COLUMN', N'tab_key';
GO
-- 回填:来料检验要求的动态字段(备用列)→ 归「自定义检验要求」页签(改动前的显示位置)
UPDATE yj_field SET tab_key = N'自定义检验要求'
 WHERE panel_code = N'QC_INSP_REQ' AND col_name LIKE N'备用%' AND tab_key IS NULL;
PRINT N'[OK] 已回填动态字段所属页签 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ═════════════ 自检 ═════════════
SELECT N'tab_key 列' AS k, CASE WHEN COL_LENGTH('dbo.yj_field', N'tab_key') IS NOT NULL THEN N'存在' ELSE N'缺失!' END AS v;
SELECT N'来料检验要求动态字段' AS k, col_name, label, tab_key FROM yj_field
 WHERE panel_code = N'QC_INSP_REQ' AND col_name LIKE N'备用%' ORDER BY seq, id;
SELECT N'按页签统计(全库)' AS k, ISNULL(tab_key, N'(不区分)') AS 页签, COUNT(*) AS 字段数
  FROM yj_field GROUP BY tab_key ORDER BY 字段数 DESC;
GO
