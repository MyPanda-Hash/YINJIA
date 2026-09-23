/* ============================================================================
   migrate-sinter-tolerance.sql —— 烧结尺寸表(60 行模具↔炭棒内外径公差对照)+ 档案面板登记
   ============================================================================
   ⚠ 本文件由 tools/gen/gen-sinter-tolerance.cjs 从设计源自动生成,不要手改。
     设计源:《20267月22日-最新烧结配方模板-1.xlsx》sheet「烧结尺寸表」(A1:I63,R4~R63 共 60 行)
     重新生成:node tools/gen/gen-sinter-tolerance.cjs

   用途(见 docs/design/研发管理-新面板设计与改动方案.md §12.4 / CONTEXT.md「配方计算器」):
     配方计算弹窗按「车间 + 型号」从这张表带出炭棒外径/内径与其公差,回填到成型工艺清单页 1 的
     「检验要求 · 炭棒尺寸」四格 —— 工艺员不必再每单手敲;计算用的外径/内径也取自这里(优先于手填)。
   维护:登记成**档案面板**(mode='archive'),用现成的列表 + 内联编辑,不另写维护界面。

   脏值**原样保留**(§12.4 明示):长度范围里混备注的两行、带"（只可做低精度）"的两行,业务看得懂;
   程式只解析前段 NNN-NNN。另外 walk 产物里的单元格内换行 '⏎' 已还原成真换行。

   幂等:表/字段/译名按存在判;种子按 **车间+型号** 去重(已存在不覆盖,便于人工修正后重跑)。
   两个账套都要执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST),执行须带 QUOTED_IDENTIFIER ON(sqlcmd -I)。
   ============================================================================ */

SET NOCOUNT ON;
GO

/* ── ① 建表(中文列名,与 yj_field.label 同名同序)+ 中文注明(AGENTS 硬规范)── */
IF OBJECT_ID('rd_sinter_tolerance') IS NULL
BEGIN
    CREATE TABLE rd_sinter_tolerance (
        id int IDENTITY(1,1) PRIMARY KEY,
        [车间] nvarchar(20) NULL,
        [型号] nvarchar(40) NULL,
        [模具尺寸] nvarchar(20) NULL,
        [中心杆尺寸] nvarchar(20) NULL,
        [炭棒外径] nvarchar(20) NULL,
        [炭棒外径公差] nvarchar(20) NULL,
        [炭棒内径] nvarchar(20) NULL,
        [炭棒内径公差] nvarchar(20) NULL,
        [长度范围] nvarchar(80) NULL,
        [停用] bit NULL DEFAULT 0,
        seq int NULL DEFAULT 0,
        asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
        asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
        asp_cancel char(1) NULL DEFAULT 'N'
    );
    PRINT N'migrate-sinter-tolerance.sql:已建表 rd_sinter_tolerance';
END
ELSE PRINT N'migrate-sinter-tolerance.sql:表 rd_sinter_tolerance 已存在';
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('rd_sinter_tolerance') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'烧结尺寸表:烧结车间模具对应的炭棒内外径与公差对照(配方计算按车间+型号带出尺寸)', N'SCHEMA', N'dbo', N'TABLE', N'rd_sinter_tolerance';
GO
DECLARE @cols TABLE (c sysname, d nvarchar(200));
INSERT INTO @cols VALUES
 (N'车间', N'烧结车间编号(与成型工艺清单的生产车间同口径)'),
 (N'型号', N'模具型号(外径*内径),车间内唯一'),
 (N'模具尺寸', N'模具外径 mm'),
 (N'中心杆尺寸', N'中心杆外径 mm'),
 (N'炭棒外径', N'炭棒外径 mm(成品)'),
 (N'炭棒外径公差', N'炭棒外径公差(含 ± 号,原样保留)'),
 (N'炭棒内径', N'炭棒内径 mm(成品)'),
 (N'炭棒内径公差', N'炭棒内径公差(含 ± 号,原样保留)'),
 (N'长度范围', N'该模具可做长度范围 NNN-NNN;个别行带车间备注/精度说明(原样保留,程式只解析前段数字)');
DECLARE @c sysname, @d nvarchar(200);
DECLARE cur CURSOR FOR SELECT c, d FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE major_id = OBJECT_ID('rd_sinter_tolerance')
                     AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_sinter_tolerance'), @c, 'ColumnId')
                     AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', N'rd_sinter_tolerance', N'COLUMN', @c;
    FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ── ② 登记档案面板(用现成列表/内联编辑维护 60 行)── */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_SINTER_TOL')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('RD_SINTER_TOL', N'烧结尺寸表', N'基础设置', 'archive', 'rd_sinter_tolerance', NULL, NULL, 'id', N'型号', NULL, NULL, 200, 'items', N'基础设置', 'Sintering Size Table');
GO

/* ── ③ 字段登记(place 照抄既有档案面板口径:列表列 query,detail)── */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL' AND col_name = N'车间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SINTER_TOL', N'车间', N'车间', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 90, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL' AND col_name = N'型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SINTER_TOL', N'型号', N'型号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 130, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL' AND col_name = N'模具尺寸')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SINTER_TOL', N'模具尺寸', N'模具尺寸', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 30, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL' AND col_name = N'中心杆尺寸')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SINTER_TOL', N'中心杆尺寸', N'中心杆尺寸', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 40, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL' AND col_name = N'炭棒外径')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SINTER_TOL', N'炭棒外径', N'炭棒外径', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 50, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL' AND col_name = N'炭棒外径公差')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SINTER_TOL', N'炭棒外径公差', N'炭棒外径公差', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL' AND col_name = N'炭棒内径')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SINTER_TOL', N'炭棒内径', N'炭棒内径', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 70, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL' AND col_name = N'炭棒内径公差')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SINTER_TOL', N'炭棒内径公差', N'炭棒内径公差', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL' AND col_name = N'长度范围')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SINTER_TOL', N'长度范围', N'长度范围', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 90, 170, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL' AND col_name = N'停用')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SINTER_TOL', N'停用', N'停用', N'是否', NULL, NULL, NULL, NULL, N'detail', 100, 80, 1, 0, 0, 1);
GO

/* ── ④ 译名(AGENTS:新面板/新字段必须带译名;此处给 en,其余语言由机翻兜底)── */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'车间' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'车间', 'en', N'Workshop', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'型号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'型号', 'en', N'Model', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'模具尺寸' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'模具尺寸', 'en', N'Mold Size', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'中心杆尺寸' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'中心杆尺寸', 'en', N'Center Rod Size', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'炭棒外径' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒外径', 'en', N'Rod OD', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'炭棒外径公差' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒外径公差', 'en', N'Rod OD Tol.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'炭棒内径' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒内径', 'en', N'Rod ID', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'炭棒内径公差' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒内径公差', 'en', N'Rod ID Tol.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'长度范围' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'长度范围', 'en', N'Length Range', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'烧结尺寸表' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'烧结尺寸表', 'en', N'Sintering Size Table', 'manual');
GO

/* ── ⑤ 60 行种子(按 车间+型号 去重;已存在不覆盖)── */
PRINT N'--- 播种 60 行烧结尺寸 ---';

IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'16*9')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'16*9', N'16', N'9', N'15.5', N'±0.5', N'8.5', N'±0.5', N'10-120', 1, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'18*9')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'18*9', N'18', N'9', N'17.5', N'±0.5', N'8.5', N'±0.5', N'10-120', 2, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'24*9')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'24*9', N'24', N'9', N'23.5', N'±0.5', N'8.5', N'±0.5', N'10-120', 3, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'24*10')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'24*10', N'24', N'9.8', N'23.5', N'±0.5', N'9.5', N'±0.5', N'10-120', 4, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'27*12')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'27*12', N'27', N'12', N'26.5', N'±0.5', N'11.5', N'±0.5', N'10-270', 5, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'28*11')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'28*11', N'28', N'11', N'27.5', N'±0.5', N'10.5', N'±0.5', N'10-220', 6, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'28*12')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'28*12', N'28', N'12', N'27.5', N'±0.5', N'11.5', N'±0.5', N'10-220', 7, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'28*13')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'28*13', N'28', N'13', N'27.5', N'±0.5', N'12.5', N'±0.5', N'10-220', 8, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'30*10')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'30*10', N'30', N'10', N'29.5', N'±0.5', N'9.5', N'±0.5', N'10-270', 9, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'30*12')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'30*12', N'30', N'12', N'29.5', N'±0.5', N'11.5', N'±0.5', N'10-270', 10, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'32*10')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'32*10', N'32', N'10', N'31.5', N'±0.5', N'9.5', N'±0.5', N'10-270', 11, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'32*12')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'32*12', N'32', N'12', N'31.5', N'±0.5', N'11.5', N'±0.5', N'10-270', 12, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'35*10')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'35*10', N'35', N'10', N'34.5', N'±0.5', N'9.5', N'±0.5', N'10-270', 13, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'35*13')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'35*13', N'35', N'13', N'34.5', N'±0.5', N'12.5', N'±0.5', N'10-270', 14, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'38*10')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'38*10', N'38', N'10', N'37.5', N'±0.5', N'9.5', N'±0.5', N'10-270', 15, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'38*12')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'38*12', N'38', N'12', N'37.5', N'±0.5', N'11.5', N'±0.5', N'10-270', 16, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'2' AND RTRIM([型号]) = N'38*13')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'2', N'38*13', N'38', N'13', N'37.5', N'±0.5', N'12.5', N'±0.5', N'10-270', 17, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'39*12')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'39*12', N'39', N'12', N'38.5', N'±0.5', N'11.5', N'±0.5', N'10-140', 18, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'34*12')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'34*12', N'34', N'12', N'33.5', N'±0.5', N'11.5', N'±0.5', N'10-270', 19, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'34*16')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'34*16', N'34', N'16', N'33.5', N'±0.5', N'15.5', N'±0.5', N'10-270', 20, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'37*12')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'37*12', N'37', N'12', N'36.5', N'±0.5', N'11.5', N'±0.5', N'10-270', 21, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'37*16')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'37*16', N'37', N'16', N'36.5', N'±0.5', N'15.5', N'±0.5', N'10-270', 22, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'37*23')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'37*23', N'37', N'23', N'36.5', N'±0.5', N'22.5', N'±0.5', N'10-270', 23, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'40.5*10')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'40.5*10', N'40.5', N'10', N'40', N'±0.5', N'9.5', N'±0.5', N'10-270', 24, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'40.5*12')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'40.5*12', N'40.5', N'12', N'40', N'±0.5', N'11.5', N'±0.5', N'10-270', 25, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'40.5*16')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'40.5*16', N'40.5', N'16', N'40', N'±0.5', N'15.5', N'±0.5', N'10-270', 26, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'40.5*22')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'40.5*22', N'40.5', N'22', N'40', N'±0.5', N'21.5', N'±0.5', N'10-270', 27, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'40.5*25')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'40.5*25', N'40.5', N'25', N'40', N'±0.5', N'24.5', N'±0.5', N'10-270', 28, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'45*10')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'45*10', N'45', N'10', N'44.5', N'±0.5', N'9.5', N'±0.5', N'10-270', 29, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'45*16')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'45*16', N'45', N'16', N'44.5', N'±0.5', N'15.5', N'±0.5', N'10-270', 30, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'45*21')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'45*21', N'45', N'21.3', N'44.5', N'±0.5', N'20.8', N'±0.5', N'10-270', 31, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'3' AND RTRIM([型号]) = N'45*22')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'3', N'45*22', N'45', N'22', N'44.5', N'±0.5', N'21.5', N'±0.5', N'10-270', 32, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1/3' AND RTRIM([型号]) = N'45*25')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1/3', N'45*25', N'45', N'25', N'44.5', N'±0.5', N'24.5', N'±0.5', N'10-300', 33, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'47*21')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'47*21', N'47', N'21.3', N'46.5', N'±0.5', N'20.8', N'±0.5', N'10-300', 34, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'48*25')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'48*25', N'48.5', N'25', N'48', N'±0.5', N'24.5', N'±0.5', N'10-300', 35, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'48*26')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'48*26', N'48.5', N'26', N'48', N'±0.5', N'25.5', N'±0.5', N'10-300', 36, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'48*30')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'48*30', N'48.5', N'30', N'48', N'±0.5', N'29.5', N'±0.5', N'10-300', 37, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'50*16')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'50*16', N'50', N'16', N'49.5', N'±0.5', N'15.5', N'±0.5', N'10-300', 38, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'50*21')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'50*21', N'50', N'21.3', N'49.5', N'±0.5', N'20.8', N'±0.5', N'10-300', 39, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'50*25')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'50*25', N'50', N'25', N'49.5', N'±0.5', N'24.5', N'±0.5', N'10-300', 40, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'50*30')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'50*30', N'50', N'30', N'49.5', N'±0.5', N'29.5', N'±0.5', N'10-300', 41, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'53*16')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'53*16', N'53.2', N'16', N'52.7', N'±0.5', N'15.5', N'±0.5', N'10-300', 42, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'53*21')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'53*21', N'53.2', N'21.3', N'52.7', N'±0.5', N'20.8', N'±0.5', N'10-300', 43, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'57*16')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'57*16', N'57', N'16', N'56.5', N'±0.5', N'15.5', N'±0.5', N'10-300', 44, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'57*30')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'57*30', N'57', N'30', N'56.5', N'±0.5', N'29.5', N'±0.5', N'1#车间不封底10-300 
4#车间封底200-220', 45, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'60*25')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'60*25', N'60', N'25', N'59.5', N'±0.5', N'24.5', N'±0.5', N'10-300', 46, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'60*30')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'60*30', N'60', N'30', N'59.5', N'±0.5', N'29.5', N'±0.5', N'10-300', 47, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'60*40')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'60*40', N'60', N'40', N'59.5', N'±0.5', N'39.5', N'±0.5', N'10-300', 48, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'60*42')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'60*42', N'60', N'42', N'59.5', N'±0.5', N'41.5', N'±0.5', N'10-300', 49, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'60*45')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'60*45', N'60', N'45', N'59.5', N'±0.5', N'44.5', N'±0.5', N'10-300 （只可做低精度）', 50, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'63*34')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'63*34', N'63', N'34', N'62.5', N'±0.5', N'33.5', N'±0.5', N'10-300', 51, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'63*40')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'63*40', N'63', N'40', N'62.5', N'±0.5', N'39.5', N'±0.5', N'10-300', 52, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'63*50')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'63*50', N'63', N'50', N'62.5', N'±0.5', N'49.5', N'±0.5', N'10-300 （只可做低精度）', 53, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'64*35')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'64*35', N'64', N'35', N'63', N'±1', N'34', N'±1', N'10-500', 54, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'1' AND RTRIM([型号]) = N'66.9*21')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'1', N'66.9*21', N'66.9', N'21.3', N'66.4', N'+0.5-1', N'20.8', N'+0.5-1', N'10-300', 55, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'80*35')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'80*35', N'80', N'35', N'79', N'±1', N'34', N'±1', N'10-350', 56, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'88.5*69.7')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'88.5*69.7', N'89', N'70', N'88.5', N'±0.8', N'69', N'±0.5', N'10-200', 57, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'91*28')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'91*28', N'91', N'28', N'90', N'±1', N'27', N'±1', N'10-260', 58, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'91*65')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'91*65', N'91', N'65', N'90', N'±1', N'64', N'±1', N'10-260', 59, 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = N'4' AND RTRIM([型号]) = N'106*57')
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (N'4', N'106*57', N'106', N'57', N'105', N'±1', N'56', N'±1', N'10-190', 60, 'system', SYSDATETIME());
GO

/* ── 核验 ── */
SELECT COUNT(*) AS 行数 FROM rd_sinter_tolerance;
SELECT [车间], COUNT(*) AS 行数 FROM rd_sinter_tolerance GROUP BY [车间] ORDER BY [车间];
SELECT COUNT(*) AS 面板登记 FROM yj_panel WHERE panel_code = 'RD_SINTER_TOL';
SELECT COUNT(*) AS 字段登记 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL';
SELECT TOP 3 [车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围] FROM rd_sinter_tolerance ORDER BY seq;
GO
