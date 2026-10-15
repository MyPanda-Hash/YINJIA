-- migrate-drop-qc-mold-cut-finspec-20261016.sql
--   —— 下架品质管理「成型检验单 QC_MOLD_INSP / 切炭检验单 QC_CUT_INSP / 成品检验规范 QC_FIN_SPEC」3 张面板
--
-- 用户口径(2026-10-16):「删除当前成型检验单和切炭检验单,以及成品检验规范。」
--   (在做的「制程检验单 QC_PROC_INSP」「成品检验单 QC_ASM_INSP」已承接这两类工序检验与成品检验的职能;
--    本批走**重路线**:连面板元数据、账单数据、物理表一起删,不是仅摘菜单。)
--
-- ══════ 逐个列明删了什么(便于日后追溯)══════
--   面板 3 个 :QC_MOLD_INSP 成型检验单(前缀 CX) / QC_CUT_INSP 切炭检验单(前缀 QT) / QC_FIN_SPEC 成品检验规范(前缀 CPJY)
--   yj_field        118 行(40 + 40 + 38)
--   yj_role_panel    14 行(7 + 7 + 0)
--   yj_doc_status    正式库 38 行 / 测试库 144 行(每张单据一行状态)
--   yj_translation   面板名 3 行 + **孤儿**字段标签(守卫:仅当已无任何字段行用该标签时才删)
--   form_flow_link   生单占用链(正式库 5 行 / 测试库 63 行)
--   yj_form_approval 审批痕迹(正式库 6 行 / 测试库 0 行)
--   视图             **无**(这 3 张都是 doc 面板,不绑视图;脚本仍带一道动态护栏)
--   物理表 6 张      qc_mold_insp_head/_detail、qc_cut_insp_head/_detail、qc_fin_spec_head/_detail
--
-- ══════ ⚠ 本批**带数据**下架(与 2026-10-09 那批「0 行面板」性质不同)══════
--   正式库 HSDZ_MES        :成型 24 单 + 20 行 / 切炭 9 单 + 7 行 / 成品检验规范 8 单 + 20 行
--   测试库 HSDZ_MES_TEST   :成型 109 单 + 44 行 / 切炭 18 单 + 7 行 / 成品检验规范 21 单 + 41 行
--   (这些单据多半是**报工审核自动生成**的草稿型凭证;留痕 yj_usage_log 显示正式库有人工动作:
--    成型 提交5/审批通过2/弃审2/删除1、切炭 提交1、成品检验规范 提交4/删除3。)
--   ⇒ 数据**不是**空的,删了就没了 —— 所以先做了全量备份(见下),执行前请确认确实不要了。
--
-- ══════ 回退抓手 ══════
--   tools/archive/_qc-drop3/_backup-20261016-prod/ 与 _backup-20261016-test/
--      restore-metadata.sql(yj_panel/yj_field/yj_role_panel/yj_translation/yj_doc_status 的 INSERT)
--      data.sql(6 张业务表全部行)
--      tables-ddl.sql(6 张表重建)  columns.tsv(列清单)  rowcounts.txt(行数)
--   回退顺序:先跑 tables-ddl.sql → restore-metadata.sql → data.sql(两账套各跑对应目录),再回滚本提交的代码改动。
--   (yj_usage_log 的留痕**不动** —— 那是审计流水,删了反而查不清历史。)
--
-- ══════ 依据(2026-10-16 实测,证据 tools/archive/_qc-drop3/)══════
--   · 依赖面:无外键、无 v_* 视图、无报表模板(jrxml/properties 里都没有这三张)、
--     yj_attachment/report_column_settings/yj_doc_batch 全 0;yj_field.ref_panel 无人指向它们。
--   · 代码面(随本脚本同批清理):
--       ButtonService        —— 报工审核自动生成 成型/切炭/成品检验规范 三段 + 弃审作废链 + finSpecGenerate()
--       ScheduleBoardService —— 工单排产看板里 成型/切炭 两张检验单列
--       PanelConfigService   —— 检验项目下发面板集合
--       QcInspPlanController —— 检验项目维护面板白名单
--       前端                 —— menus.js / PanelxList.SECTION_PANELS / recordSheetConfigs(QC_FIN_SPEC 页式配置)
--   · 顺带:单据编号前缀 CX / QT / CPJY 的号池台账 s_allno **不删**(历史发号痕迹,留着不影响新号)。
--
-- 幂等:每步带存在性守卫,重跑为 no-op。
-- 两账套都要执行(先正式、后测试):
--   正式 tools> java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-qc-mold-cut-finspec-20261016.sql
--   测试 tools> set YINJIA_SQL_DB=HSDZ_MES_TEST && java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-qc-mold-cut-finspec-20261016.sql
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库时不得被切走)
GO
PRINT N'[库] ' + DB_NAME() + N' — 下架 成型检验单 / 切炭检验单 / 成品检验规范';
GO
-- ═══ 清单(临时表跨批可用)═══
IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
CREATE TABLE #p (code varchar(40) PRIMARY KEY);
INSERT INTO #p(code) VALUES ('QC_MOLD_INSP'), ('QC_CUT_INSP'), ('QC_FIN_SPEC');
IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
CREATE TABLE #t (name sysname PRIMARY KEY);
INSERT INTO #t(name) VALUES ('qc_mold_insp_detail'), ('qc_mold_insp_head'),
                            ('qc_cut_insp_detail'),  ('qc_cut_insp_head'),
                            ('qc_fin_spec_detail'),  ('qc_fin_spec_head');
IF OBJECT_ID('tempdb..#names')  IS NOT NULL DROP TABLE #names;
IF OBJECT_ID('tempdb..#labels') IS NOT NULL DROP TABLE #labels;
IF OBJECT_ID('tempdb..#before') IS NOT NULL DROP TABLE #before;
SELECT DISTINCT panel_name AS name INTO #names  FROM dbo.yj_panel WHERE panel_code IN (SELECT code FROM #p);
SELECT DISTINCT label      AS name INTO #labels FROM dbo.yj_field WHERE panel_code IN (SELECT code FROM #p);
SELECT (SELECT COUNT(*) FROM dbo.yj_panel) AS panels, (SELECT COUNT(*) FROM dbo.yj_field) AS fields INTO #before;
-- ⚠ PRINT 里不能直接写子查询(Msg 1046「Subqueries are not allowed in this context」),先取到变量再拼
DECLARE @bp int = (SELECT panels FROM #before), @bf int = (SELECT fields FROM #before),
        @nn int = (SELECT COUNT(*) FROM #names), @nl int = (SELECT COUNT(*) FROM #labels);
PRINT N'[账前] 面板 ' + CAST(@bp AS nvarchar(10)) + N' 个 / 字段 ' + CAST(@bf AS nvarchar(10))
    + N' 行 / 待删面板名 ' + CAST(@nn AS nvarchar(10)) + N' 个 / 待删面板字段标签 ' + CAST(@nl AS nvarchar(10)) + N' 个';
GO
-- ═══ ① 留档:待删 6 张表的行数(下架连数据一起删,这行数字是事后唯一的对账依据)═══
DECLARE @tb sysname, @sql nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM #t;
OPEN cur; FETCH NEXT FROM cur INTO @tb;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID('dbo.' + @tb, 'U') IS NOT NULL
  BEGIN
    SET @sql = N'SELECT ''' + @tb + ''' AS 待删表, COUNT(*) AS 行数 FROM dbo.' + QUOTENAME(@tb);
    EXEC sp_executesql @sql;
  END
  ELSE
    SELECT @tb AS 待删表, N'(不存在,跳过)' AS 行数;
  FETCH NEXT FROM cur INTO @tb;
END
CLOSE cur; DEALLOCATE cur;
GO
-- ═══ ② 安全闸:不得有外键指向待删表(有则中止,先人工处理)═══
DECLARE @fk nvarchar(400) = N'';
SELECT @fk = @fk + OBJECT_NAME(fk.parent_object_id) + N'→' + OBJECT_NAME(fk.referenced_object_id) + N' '
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.referenced_object_id) IN (SELECT name FROM #t);
IF @fk <> N''
  RAISERROR(N'[中止] 有外键指向待删表,拒绝下架:%s', 16, 1, @fk);
ELSE
  PRINT N'[安全闸] 无外键指向待删表';
GO
-- ═══ ③ 生单链路占用行(报工 → 检验单的占用链)═══
DELETE FROM dbo.form_flow_link
 WHERE source_panel_code IN (SELECT code FROM #p) OR target_panel_code IN (SELECT code FROM #p);
PRINT N'[删] form_flow_link ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ═══ ④ 角色授权 ═══
DELETE FROM dbo.yj_role_panel WHERE panel_code IN (SELECT code FROM #p);
PRINT N'[删] yj_role_panel ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ═══ ⑤ 字段登记 ═══
DELETE FROM dbo.yj_field WHERE panel_code IN (SELECT code FROM #p);
PRINT N'[删] yj_field ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ═══ ⑥ 面板登记 ═══
DELETE FROM dbo.yj_panel WHERE panel_code IN (SELECT code FROM #p);
PRINT N'[删] yj_panel ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ═══ ⑦ 译名(面板名:仅当已无任何面板同名;字段标签:仅当已无任何字段行用它)═══
DELETE t FROM dbo.yj_translation t
 WHERE t.scope = 'panel' AND t.ref_key IN (SELECT name FROM #names)
   AND NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_name = t.ref_key);
PRINT N'[删] yj_translation(panel 名) ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
DELETE t FROM dbo.yj_translation t
 WHERE t.scope = 'field' AND t.ref_key IN (SELECT name FROM #labels)
   AND NOT EXISTS (SELECT 1 FROM dbo.yj_field f WHERE f.label = t.ref_key);
PRINT N'[删] yj_translation(孤儿字段标签) ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ═══ ⑧ 单据状态 / 审批痕迹(单据本体随表删除,这两处是按 panel_code 记的运行态)═══
DELETE FROM dbo.yj_doc_status WHERE panel_code IN (SELECT code FROM #p);
PRINT N'[删] yj_doc_status ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
IF OBJECT_ID('dbo.yj_form_approval', 'U') IS NOT NULL
BEGIN
  DELETE FROM dbo.yj_form_approval WHERE panel_code IN (SELECT code FROM #p);
  PRINT N'[删] yj_form_approval ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
END
GO
-- ═══ ⑨ 视图护栏:本批实测无视图,但若日后有人给这三张表建了视图,先删掉再删表(避免悬空)═══
DECLARE @v sysname, @vsql nvarchar(400);
DECLARE vcur CURSOR LOCAL FAST_FORWARD FOR
  SELECT o.name FROM sys.objects o
   WHERE o.type = 'V' AND EXISTS (SELECT 1 FROM sys.sql_modules m WHERE m.object_id = o.object_id
           AND (m.definition LIKE N'%qc_mold_insp%' OR m.definition LIKE N'%qc_cut_insp%' OR m.definition LIKE N'%qc_fin_spec%'));
OPEN vcur; FETCH NEXT FROM vcur INTO @v;
WHILE @@FETCH_STATUS = 0
BEGIN
  PRINT N'[删] 视图 ' + @v + N'(它的定义引用了待删表)';
  SET @vsql = N'DROP VIEW dbo.' + QUOTENAME(@v);
  EXEC sp_executesql @vsql;
  FETCH NEXT FROM vcur INTO @v;
END
CLOSE vcur; DEALLOCATE vcur;
PRINT N'[视图护栏] 检查完毕(无输出即本来就没有视图)';
GO
-- ═══ ⑩ 物理表 6 张(行表先删,表头后删)═══
IF OBJECT_ID('dbo.qc_mold_insp_detail', 'U') IS NOT NULL DROP TABLE dbo.qc_mold_insp_detail;
IF OBJECT_ID('dbo.qc_mold_insp_head',   'U') IS NOT NULL DROP TABLE dbo.qc_mold_insp_head;
IF OBJECT_ID('dbo.qc_cut_insp_detail',  'U') IS NOT NULL DROP TABLE dbo.qc_cut_insp_detail;
IF OBJECT_ID('dbo.qc_cut_insp_head',    'U') IS NOT NULL DROP TABLE dbo.qc_cut_insp_head;
IF OBJECT_ID('dbo.qc_fin_spec_detail',  'U') IS NOT NULL DROP TABLE dbo.qc_fin_spec_detail;
IF OBJECT_ID('dbo.qc_fin_spec_head',    'U') IS NOT NULL DROP TABLE dbo.qc_fin_spec_head;
PRINT N'[删] 6 张物理表(不存在则跳过)';
GO
-- ═══ ⑪ 自检(期望值写在「期望」列;面板/字段总数为账前 − 3 / − 118,故按 #before 相对校验,两个账套通用)═══
SELECT N'yj_panel 残留'          AS 检查项, COUNT(*) AS 值, N'0' AS 期望 FROM dbo.yj_panel WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'yj_field 残留', COUNT(*), N'0' FROM dbo.yj_field WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'yj_role_panel 残留', COUNT(*), N'0' FROM dbo.yj_role_panel WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'yj_doc_status 残留', COUNT(*), N'0' FROM dbo.yj_doc_status WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'form_flow_link 残留', COUNT(*), N'0' FROM dbo.form_flow_link
        WHERE source_panel_code IN (SELECT code FROM #p) OR target_panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'yj_form_approval 残留', COUNT(*), N'0' FROM dbo.yj_form_approval WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'物理对象残留', COUNT(*), N'0' FROM sys.objects WHERE name IN (SELECT name FROM #t)
UNION ALL SELECT N'面板总数', COUNT(*), CAST((SELECT panels - 3 FROM #before) AS nvarchar(10)) FROM dbo.yj_panel
UNION ALL SELECT N'字段总数', COUNT(*), CAST((SELECT fields - 118 FROM #before) AS nvarchar(10)) FROM dbo.yj_field
UNION ALL SELECT N'保留的制程品质三张(首件/制程/组装成品)', COUNT(*), N'3' FROM dbo.yj_panel
        WHERE panel_code IN ('QC_FIRST_INSP', 'QC_PROC_INSP', 'QC_ASM_INSP')
UNION ALL SELECT N'保留的质量单据七张', COUNT(*), N'7' FROM dbo.yj_panel
        WHERE panel_code IN ('QC_BHG', 'QC_BHC', 'QC_BHZ', 'QC_JJF', 'QC_SCP', 'QC_LYB', 'QC_SCY')
UNION ALL SELECT N'悬空 panel 引用的字段', COUNT(*), N'0' FROM dbo.yj_field f
        WHERE f.ref_panel IS NOT NULL AND f.ref_panel <> N'' AND NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_code = f.ref_panel)
UNION ALL SELECT N'指向不存在表/视图的面板', COUNT(*), N'0' FROM dbo.yj_panel p
        WHERE (p.line_table IS NOT NULL AND p.line_table <> N'' AND OBJECT_ID(p.line_table) IS NULL)
           OR (p.head_table IS NOT NULL AND p.head_table <> N'' AND OBJECT_ID(p.head_table) IS NULL)
UNION ALL SELECT N'仍有对象引用被删表', COUNT(*), N'0' FROM sys.sql_modules m
        WHERE m.definition LIKE N'%qc_mold_insp%' OR m.definition LIKE N'%qc_cut_insp%' OR m.definition LIKE N'%qc_fin_spec%';
GO
PRINT N'[完] 成型检验单 / 切炭检验单 / 成品检验规范 已整体下架(回退见脚本头「回退抓手」)';
GO
