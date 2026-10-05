-- migrate-qc-insp-req-series.sql — 新增面板「来料检验要求(系列)」:10 张**全自定义**检验要求表
--
-- 用户口径(2026-10-04 第四轮):「现在将那个自定义的表删除,然后多增加一个来料检验要求的面版,
--   下面有这几个切换表(而且都是自定义的),实现和之前一致,只是为了不要太多的表都集中在一个面版
--   才拆成两个:阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料」
--
-- 形态:与「来料检验要求」(QC_INSP_REQ)完全同构 —— 档案式整表面板、规格书式页签 + Excel 复刻表格、
--   行按 物料类别 分流到页签、保存走 saveArchive;
--   差别:本面板 **10 个页签全部是"自定义表"**(列 = 动态字段/备用列池,管理员在「自定义字段」里加),
--         而 QC_INSP_REQ 是 7 张**固定**表(Excel 一比一)。
-- 拆两张表的理由:两个面板各自一份数据/各自的扩展池/各自的保存边界(档案式保存是"整表 upsert",
--   同表混装会让 A 面板保存时看到 B 面板的行)。
--
-- 扩展池:沿用「每张表(页签)各 20 个」口径 ⇒ 本表 备用1..备用200(10 段 ×20):
--   ① 阻垢系列 备用1-20      ⑥ 载银系列 备用101-120
--   ② BK材料系列 备用21-40   ⑦ 炭粉 备用121-140
--   ③ 除重金属系列 备用41-60 ⑧ 胶粉 备用141-160
--   ④ 矿化(碱性)系列 备用61-80 ⑨ 矿化料 备用161-180
--   ⑤ 抑菌系列 备用81-100    ⑩ 原料来料 备用181-200
--   ⚠ 段序 = 物料类别 词表顺序(本脚本里的 VALUES 顺序),改顺序要连页签、词典、随机带一起改。
--
-- 幂等:表/面板/字段/权限/译名均加存在性守卫;备用列逐列 IF COL_LENGTH。
-- 两账套都要执行:
--   正式 java -cp lib\mssql-jdbc.jar DbSync.java run migrate-qc-insp-req-series.sql
--   测试 YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar DbSync.java run migrate-qc-insp-req-series.sql
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库时不得被切走)
GO

-- ═════════════ 1. 业务表 qc_insp_req_series(与 qc_insp_req 同构 + 200 个扩展位) ═════════════
IF OBJECT_ID('qc_insp_req_series') IS NULL
CREATE TABLE qc_insp_req_series (
  id int IDENTITY(1,1) PRIMARY KEY,
  [物料类别] nvarchar(20) NOT NULL,      -- 页签:阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料
  [物料编号] nvarchar(60) NOT NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO
-- 扩展位:备用1..备用200(每页签 20 个)
DECLARE @i int = 1, @sql nvarchar(300);
WHILE @i <= 200
BEGIN
  SET @sql = N'IF COL_LENGTH(''qc_insp_req_series'', N''备用' + CAST(@i AS nvarchar(3)) + N''') IS NULL '
           + N'ALTER TABLE qc_insp_req_series ADD [备用' + CAST(@i AS nvarchar(3)) + N'] nvarchar(500) NULL;';
  EXEC sp_executesql @sql;
  SET @i = @i + 1;
END
PRINT N'[OK] qc_insp_req_series 扩展位已补齐至 备用200';
GO

-- ═════════════ 2. 表/列中文注明(AGENTS.md 2026-09-14 起强制) ═════════════
DECLARE @t sysname = N'qc_insp_req_series';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description', N'来料检验要求(系列)表(10 张全自定义检验要求表并集:阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料;档案式全局资料,无单据号;物料类别=页签;列由动态字段/备用列池承载)', N'SCHEMA', N'dbo', N'TABLE', @t;
ELSE
  EXEC sp_addextendedproperty    N'MS_Description', N'来料检验要求(系列)表(10 张全自定义检验要求表并集:阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料;档案式全局资料,无单据号;物料类别=页签;列由动态字段/备用列池承载)', N'SCHEMA', N'dbo', N'TABLE', @t;
GO
DECLARE @cols TABLE (c sysname, d nvarchar(300));
INSERT INTO @cols VALUES
  (N'物料类别', N'物料类别(页签:阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料)'),
  (N'物料编号', N'物料编号(检验报告「按物料编码带入检验要求」的匹配键)'),
  (N'asp_user1', N'创建人'), (N'asp_time1', N'创建时间'), (N'asp_user2', N'修改人'), (N'asp_time2', N'修改时间'), (N'asp_cancel', N'作废标志(Y/N)');
DECLARE @c sysname, @d nvarchar(300);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT c, d FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('qc_insp_req_series')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('qc_insp_req_series'), @c, 'ColumnId') AND ep.name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_req_series', N'COLUMN', @c;
  ELSE
    EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_req_series', N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[OK] 关键列注明已写';
GO
-- 200 个扩展位的注明(按页签分段)
DECLARE @j int = 1, @cc nvarchar(20), @tab nvarchar(50), @desc nvarchar(300);
DECLARE @tabs TABLE (idx int PRIMARY KEY, tab nvarchar(50));
INSERT INTO @tabs VALUES (1,N'阻垢系列'),(2,N'BK材料系列'),(3,N'除重金属系列'),(4,N'矿化（碱性）系列'),(5,N'抑菌系列'),
                         (6,N'载银系列'),(7,N'炭粉'),(8,N'胶粉'),(9,N'矿化料'),(10,N'原料来料');
WHILE @j <= 200
BEGIN
  SET @cc = N'备用' + CAST(@j AS nvarchar(3));
  SET @tab = (SELECT tab FROM @tabs WHERE idx = ((@j - 1) / 20) + 1);
  SET @desc = @tab + N'扩展池 ' + CAST(((@j - 1) % 20) + 1 AS nvarchar(3)) + N'/20(未绑定)';
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('qc_insp_req_series')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('qc_insp_req_series'), @cc, 'ColumnId') AND ep.name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @desc, N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_req_series', N'COLUMN', @cc;
  ELSE
    EXEC sp_addextendedproperty    N'MS_Description', @desc, N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_req_series', N'COLUMN', @cc;
  SET @j = @j + 1;
END
PRINT N'[OK] 200 个扩展位注明已按页签分段写好';
GO

-- ═════════════ 3. 面板注册(archive;detail_key = LOWER(panel_code),与 migrate-arch-single-doc 口径一致) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_INSP_REQ_SERIES')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
VALUES ('QC_INSP_REQ_SERIES', N'来料检验要求(系列)',
        (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验要求(系列)' AND locale='en'),
        N'基础档案', 'archive', 'qc_insp_req_series', NULL, NULL, N'id', NULL, NULL, NULL, 100, N'qc_insp_req_series', N'品质管理');
GO

-- ═════════════ 4. 字段(物料类别 10 值字典 + 物料编号;其余列由动态字段承载) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REQ_SERIES' AND col_name=N'物料类别')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
VALUES ('QC_INSP_REQ_SERIES', N'物料类别', N'物料类别', N'下拉框',
  N'SELECT v FROM (VALUES (N''阻垢系列''),(N''BK材料系列''),(N''除重金属系列''),(N''矿化（碱性）系列''),(N''抑菌系列''),(N''载银系列''),(N''炭粉''),(N''胶粉''),(N''矿化料''),(N''原料来料'')) AS t(v)',
  N'query,detail', 10, 110, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REQ_SERIES' AND col_name=N'物料编号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
VALUES ('QC_INSP_REQ_SERIES', N'物料编号', N'物料编号', N'文本', N'query,detail', 20, 130, 1, 1, 0, 1);
GO

-- ═════════════ 5. 全角色默认 view,query(与 QC_INSP_REQ 同口径) ═════════════
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, 'QC_INSP_REQ_SERIES', 'view,query', 'N'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id=r.id AND rp.panel_code='QC_INSP_REQ_SERIES');
GO

-- ═════════════ 6. 译名(AGENTS 多语言强制:面板名 + 10 个页签名,至少 en) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验要求(系列)' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验要求(系列)', 'en', N'Incoming Inspection Requirements (Series)', 'manual');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', v.tab, 'en', v.en, 'manual'
  FROM (VALUES (N'阻垢系列', N'Scale Inhibition Series'), (N'BK材料系列', N'BK Material Series'),
               (N'除重金属系列', N'Heavy Metal Removal Series'), (N'矿化（碱性）系列', N'Mineralization (Alkaline) Series'),
               (N'抑菌系列', N'Antibacterial Series'), (N'载银系列', N'Silver-Loaded Series'),
               (N'炭粉', N'Carbon Powder'), (N'胶粉', N'Binder Powder'),
               (N'矿化料', N'Mineralizing Material'), (N'原料来料', N'Raw Material Incoming')) AS v(tab, en)
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=v.tab AND t.locale='en');
GO
UPDATE yj_panel SET panel_name_en = (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验要求(系列)' AND locale='en')
 WHERE panel_code = 'QC_INSP_REQ_SERIES'
   AND ISNULL(panel_name_en, N'') <> (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验要求(系列)' AND locale='en');
GO

-- ═════════════ 自检 ═════════════
SELECT N'面板' AS k, panel_code, panel_name, mode, line_table, detail_key FROM yj_panel WHERE panel_code = 'QC_INSP_REQ_SERIES';
SELECT N'字段' AS k, col_name, label, data_type, place FROM yj_field WHERE panel_code = 'QC_INSP_REQ_SERIES' ORDER BY seq;
SELECT N'扩展位' AS k, COUNT(*) AS n FROM sys.columns WHERE object_id = OBJECT_ID('qc_insp_req_series') AND name LIKE N'备用%';
SELECT N'角色权限' AS k, COUNT(*) AS n FROM yj_role_panel WHERE panel_code = 'QC_INSP_REQ_SERIES';
SELECT N'译名' AS k, COUNT(*) AS n FROM yj_translation WHERE (scope='panel' AND ref_key=N'来料检验要求(系列)') OR (scope='field' AND ref_key IN (N'阻垢系列',N'BK材料系列',N'除重金属系列',N'矿化（碱性）系列',N'抑菌系列',N'载银系列',N'炭粉',N'胶粉',N'矿化料',N'原料来料'));
GO
