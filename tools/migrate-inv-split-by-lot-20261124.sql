/* =====================================================================================
   出入库明细「按 仓库 + 批号 分行」 + 材料出库单改名「生产领料单」 + 领料/退料部门 —— 2026-11-24

   【用户口径（原话）】
     「现在的出库单和入库单要做到不同批次号和仓库是分开记录明细的。」
     「把材料出库单改名为生产领料单，并且这个手机端会涉及到多个批次号和仓库出库的问题，重点修复。」
     「扫码填表关联领料部门，领料部门根据账号所属部门来填入。」
     「生产退料要补单号，生产退料没有单号，生产领料才有。」

   【本脚本做四件事（幂等，可重复执行）】
     ① 新建领料批次分摊台账 wo_pick_batch —— 手机扫码一次领料可能跨多个 (仓库, 批号)，
        这些分摊必须**逐笔留痕**，提交时才可能把生产领料单的明细**按仓库+批号拆成多行**
        （此前只把第一条批号写进 wo_pick_line.批号、其余塞进明细备注 ⇒ 出库单一行记全量，
         过账时其它批次/仓库的账根本没记上）。
     ② 面板改名：MATERIAL_OUT 材料出库单 → 生产领料单（连同两张报表面板），
        并补 8 种语言的 yj_translation（面板名 + 字段名）。
     ③ 表头部门字段改名：MATERIAL_OUT 部门编码 → 领料部门；MATERIAL_RET 部门编码 → 退料部门
        （值仍落物理列 部门编码，手机端扫码填表按「账号所属部门」自动带入）。
     ④ 退料台账补索引（wo_pick_return 按 领料单号+物料编码+仓库+批号 汇总已退量）。

   ⚠ 表结构改动一律 `IF ... IS NULL` 判存在 + 动态串（列名解析期不认 IF 挡住的不存在列）。
   ⚠ 两账套都要执行（先正式 HSDZ_MES、后测试 HSDZ_MES_TEST）；末尾自检必须全 PASS。
   ===================================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ───────────────────────── ① 领料批次分摊台账 ───────────────────────── */

IF OBJECT_ID('dbo.wo_pick_batch', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.wo_pick_batch (
        id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_pick_batch PRIMARY KEY,
        [领料明细id] int            NULL,          -- wo_pick_line.id（该物料在领料单上的那一行）
        [单头id]     int            NOT NULL,      -- wo_pick_doc.id
        [物料编码]   nvarchar(240)  NOT NULL,
        [仓库]       nvarchar(240)  NULL,
        [仓库编码]   nvarchar(120)  NULL,
        [批号]       nvarchar(240)  NULL,
        [数量]       decimal(18,4)  NOT NULL CONSTRAINT DF_wo_pick_batch_qty DEFAULT(0),
        asp_user1   nvarchar(100)   NULL,
        asp_time1   datetime2(0)    NULL,
        asp_user2   nvarchar(100)   NULL,
        asp_time2   datetime2(0)    NULL,
        asp_cancel  char(1)         NOT NULL CONSTRAINT DF_wo_pick_batch_cancel DEFAULT('N')
    );
    PRINT '   + 新建表 wo_pick_batch';
END
ELSE PRINT '   = 表 wo_pick_batch 已存在，跳过建表';
GO

/* 索引：按领料行取分摊 / 按单头取全单分摊 */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wo_pick_batch_line' AND object_id = OBJECT_ID('dbo.wo_pick_batch'))
    CREATE INDEX IX_wo_pick_batch_line ON dbo.wo_pick_batch([领料明细id]) INCLUDE([仓库],[仓库编码],[批号],[数量]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wo_pick_batch_head' AND object_id = OBJECT_ID('dbo.wo_pick_batch'))
    CREATE INDEX IX_wo_pick_batch_head ON dbo.wo_pick_batch([单头id]);
GO

/* 中文表/列注释（数据库规范 §2.2：只建表不注明 = 任务未完成） */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.wo_pick_batch') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产领料批次分摊台账（手机扫码一次领料跨多仓库/多批号时逐笔留痕；提交生成生产领料单时按 仓库+批号 拆明细行）',
        N'SCHEMA', N'dbo', N'TABLE', N'wo_pick_batch';
GO

DECLARE @tbl sysname = N'wo_pick_batch', @sql nvarchar(max) = N'';
DECLARE @cols TABLE (col sysname, doc nvarchar(400));
INSERT INTO @cols(col, doc) VALUES
    (N'领料明细id', N'所属领料明细行 wo_pick_line.id'),
    (N'单头id',     N'所属配对台账 wo_pick_doc.id'),
    (N'物料编码',   N'物料编码（存货编码）'),
    (N'仓库',       N'本次领料来自的仓库名称'),
    (N'仓库编码',   N'仓库编码（bs_wh.仓库编码）'),
    (N'批号',       N'本次领料的批号（空 = 无批次物料）'),
    (N'数量',       N'该仓库+批号上分摊的实领数量'),
    (N'asp_user1',  N'创建人'),
    (N'asp_time1',  N'创建时间'),
    (N'asp_user2',  N'修改人'),
    (N'asp_time2',  N'修改时间'),
    (N'asp_cancel', N'作废标记 Y/N');
DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, doc FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH('dbo.wo_pick_batch', @c) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                        WHERE major_id = OBJECT_ID('dbo.wo_pick_batch')
                          AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.wo_pick_batch'), @c, 'ColumnId')
                          AND name = 'MS_Description')
    BEGIN
        SET @sql = N'EXEC sp_addextendedproperty N''MS_Description'', N''' + REPLACE(@d, '''', '''''') + ''',
            N''SCHEMA'', N''dbo'', N''TABLE'', N''' + @tbl + ''', N''COLUMN'', N''' + @c + ''';';
        EXEC sp_executesql @sql;
    END
    FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ───────────────────────── ② 面板改名：材料出库单 → 生产领料单 ───────────────────────── */

UPDATE dbo.yj_panel
   SET panel_name = N'生产领料单',
       panel_name_en = N'Production Picking Slip'
 WHERE panel_code = 'MATERIAL_OUT'
   AND panel_name <> N'生产领料单';

UPDATE dbo.yj_panel SET panel_name = N'生产领料单明细表', panel_name_en = N'Production Picking Slip Details'
 WHERE panel_code = 'MATERIAL_OUT_DETAIL' AND (panel_name <> N'生产领料单明细表' OR panel_name_en <> N'Production Picking Slip Details');
UPDATE dbo.yj_panel SET panel_name = N'生产领料单统计表', panel_name_en = N'Production Picking Slip Statistics'
 WHERE panel_code = 'MATERIAL_OUT_STATS'  AND (panel_name <> N'生产领料单统计表' OR panel_name_en <> N'Production Picking Slip Statistics');
PRINT '   面板改名完成（MATERIAL_OUT / _DETAIL / _STATS）';
GO

/* ───────────────────────── ③ 部门字段改名（领料部门 / 退料部门） ───────────────────────── */

UPDATE dbo.yj_field
   SET label = N'领料部门'
 WHERE panel_code = 'MATERIAL_OUT' AND label = N'部门编码' AND col_name = N'部门编码';

UPDATE dbo.yj_field
   SET label = N'退料部门'
 WHERE panel_code = 'MATERIAL_RET' AND label = N'部门编码' AND col_name = N'部门编码';

-- 明细「仓库」列放开显示(2026-11-24 用户口径「不同批次号和仓库是分开记录明细的」):
-- 生产领料单的 仓库 字段原本 visible=0/hidden=1(整列隐藏),明细里根本看不到这一批货从哪个仓出。
-- 改成 列表+明细可见(不再进表头:多仓出库时单头仓库本就没有意义)。
UPDATE dbo.yj_field
   SET place = N'query,detail', visible = 1, hidden = 0
 WHERE panel_code = 'MATERIAL_OUT' AND col_name = N'仓库' AND place = N'query,header,detail';
PRINT '   部门字段改名 + 明细仓库列可见 完成';
GO

/* ───────────────────────── ④ 多语言：面板名 + 字段名（8 语言，幂等） ───────────────────────── */

DECLARE @i18n TABLE (scope varchar(20), ref_key nvarchar(200), locale varchar(10), text nvarchar(400));
INSERT INTO @i18n(scope, ref_key, locale, text) VALUES
    -- 面板：生产领料单
    ('panel', N'生产领料单', 'en', N'Production Picking Slip'),
    ('panel', N'生产领料单', 'ja', N'生産材料払出票'),
    ('panel', N'生产领料单', 'ko', N'생산 자재 불출 전표'),
    ('panel', N'生产领料单', 'de', N'Produktionsmaterialentnahme'),
    ('panel', N'生产领料单', 'fr', N'Bon de sortie de production'),
    ('panel', N'生产领料单', 'es', N'Vale de salida de producción'),
    ('panel', N'生产领料单', 'ru', N'Требование на отпуск в производство'),
    ('panel', N'生产领料单', 'vi', N'Phiếu lĩnh vật tư sản xuất'),
    ('panel', N'生产领料单', 'th', N'ใบเบิกวัสดุการผลิต'),
    -- 面板：两张报表
    ('panel', N'生产领料单明细表', 'en', N'Production Picking Slip Details'),
    ('panel', N'生产领料单明细表', 'ja', N'生産材料払出票 明細'),
    ('panel', N'生产领料单明细表', 'de', N'Produktionsmaterialentnahme Details'),
    ('panel', N'生产领料单明细表', 'fr', N'Détail du bon de sortie de production'),
    ('panel', N'生产领料单明细表', 'es', N'Detalle del vale de salida de producción'),
    ('panel', N'生产领料单明细表', 'ru', N'Детализация требования на отпуск'),
    ('panel', N'生产领料单明细表', 'vi', N'Chi tiết phiếu lĩnh vật tư'),
    ('panel', N'生产领料单明细表', 'th', N'รายละเอียดใบเบิกวัสดุการผลิต'),
    ('panel', N'生产领料单统计表', 'en', N'Production Picking Slip Statistics'),
    ('panel', N'生产领料单统计表', 'ja', N'生産材料払出票 統計'),
    ('panel', N'生产领料单统计表', 'de', N'Produktionsmaterialentnahme Statistik'),
    ('panel', N'生产领料单统计表', 'fr', N'Statistiques du bon de sortie de production'),
    ('panel', N'生产领料单统计表', 'es', N'Estadísticas del vale de salida de producción'),
    ('panel', N'生产领料单统计表', 'ru', N'Статистика требования на отпуск'),
    ('panel', N'生产领料单统计表', 'vi', N'Thống kê phiếu lĩnh vật tư'),
    ('panel', N'生产领料单统计表', 'th', N'สถิติใบเบิกวัสดุการผลิต'),
    -- 字段：领料部门 / 退料部门
    ('field', N'领料部门', 'en', N'Picking Department'),
    ('field', N'领料部门', 'ja', N'払出部門'),
    ('field', N'领料部门', 'ko', N'불출 부서'),
    ('field', N'领料部门', 'de', N'Entnahmeabteilung'),
    ('field', N'领料部门', 'fr', N'Service de sortie'),
    ('field', N'领料部门', 'es', N'Departamento de salida'),
    ('field', N'领料部门', 'ru', N'Подразделение-получатель'),
    ('field', N'领料部门', 'vi', N'Bộ phận lĩnh vật tư'),
    ('field', N'领料部门', 'th', N'แผนกเบิกวัสดุ'),
    ('field', N'退料部门', 'en', N'Return Department'),
    ('field', N'退料部门', 'ja', N'返却部門'),
    ('field', N'退料部门', 'ko', N'반납 부서'),
    ('field', N'退料部门', 'de', N'Rückgabeabteilung'),
    ('field', N'退料部门', 'fr', N'Service de retour'),
    ('field', N'退料部门', 'es', N'Departamento de devolución'),
    ('field', N'退料部门', 'ru', N'Подразделение возврата'),
    ('field', N'退料部门', 'vi', N'Bộ phận trả vật tư'),
    ('field', N'退料部门', 'th', N'แผนกคืนวัสดุ');

INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
SELECT i.scope, i.ref_key, i.locale, i.text, 'manual'
  FROM @i18n i
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation t
                    WHERE t.scope = i.scope AND t.ref_key = i.ref_key AND t.locale = i.locale);
PRINT '   多语言补登条数: ' + CAST(@@ROWCOUNT AS varchar(20));
GO

/* ───────────────────────── ⑤ 退料台账索引（按 单据+物料+仓库+批号 汇总） ───────────────────────── */

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wo_pick_return_key' AND object_id = OBJECT_ID('dbo.wo_pick_return'))
    CREATE INDEX IX_wo_pick_return_key ON dbo.wo_pick_return([领料单号], [物料编码]) INCLUDE([仓库],[批号],[退料数量],[asp_cancel]);
GO

/* ───────────────────────── ⑥ 自检（必须全 PASS） ───────────────────────── */

DECLARE @fail int = 0;

IF OBJECT_ID('dbo.wo_pick_batch', 'U') IS NULL
BEGIN PRINT '   [FAIL] wo_pick_batch 未建成功'; SET @fail = @fail + 1; END
ELSE PRINT '   [PASS] wo_pick_batch 存在';

IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = 'MATERIAL_OUT' AND panel_name = N'生产领料单')
BEGIN PRINT '   [FAIL] MATERIAL_OUT 面板名未改成 生产领料单'; SET @fail = @fail + 1; END
ELSE PRINT '   [PASS] MATERIAL_OUT 面板名 = 生产领料单';

IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = 'MATERIAL_OUT' AND col_name = N'部门编码' AND label = N'领料部门')
BEGIN PRINT '   [FAIL] MATERIAL_OUT 部门字段未改名为 领料部门'; SET @fail = @fail + 1; END
ELSE PRINT '   [PASS] MATERIAL_OUT 领料部门字段就位';

IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'生产领料单' AND locale = 'en')
BEGIN PRINT '   [FAIL] 缺少面板英文译名'; SET @fail = @fail + 1; END
ELSE PRINT '   [PASS] 面板英文译名就位';

DECLARE @langCnt int = (SELECT COUNT(DISTINCT locale) FROM dbo.yj_translation
                         WHERE scope = 'panel' AND ref_key = N'生产领料单'
                           AND locale IN ('en','ja','ko','de','fr','es','ru','vi','th'));
IF @langCnt < 9
BEGIN PRINT '   [FAIL] 面板译名只覆盖 ' + CAST(@langCnt AS varchar(10)) + '/9 种语言'; SET @fail = @fail + 1; END
ELSE PRINT '   [PASS] 面板译名覆盖 9 种语言';

IF @fail > 0
    RAISERROR(N'自检失败 %d 项，请检查上面的 [FAIL] 行', 16, 1, @fail);
ELSE
    PRINT '=== 自检全部 PASS ===';
GO
