/*
 * migrate-gen-wh-bin-prefill-20261113.sql
 *
 * 目的:采购订单生单时就能选「仓库 + 仓位」,并沿 采购订单 → 送料暂收单 → 来料检验单 →
 *       采购入库单 一路带下去(不用到下游单里再逐行填)。
 *
 * 用户口径(2026-11-13 两轮):
 *   ① 「从采购订单生单的时候就开始预填仓库仓位」;
 *   ② 「生单可以选仓库和仓位,可以每行不一样,也可以所有行带入第一个填入的仓库和仓位」;
 *   ③ 「送料暂收单 / 来料检验单 上要把 仓库、仓位 列显示出来」。
 *
 * 现状(取证见 tools/archive/_gen-prefill-20261113/):
 *   · 采购订单行 bl_pu_order:已有 仓库 / 仓库编码 / 仓库id / 仓库启用仓位管理 / 仓位id / 仓位名称 / 仓位编码
 *     (仓位系列是 hidden 列,界面不显示,生单时由对话框按行选);
 *   · 送料暂收行 sl_recv_detail:只有 仓库(且 yj_field 里 visible=0 隐藏),**没有仓位**;
 *   · 来料检验行 qc_insp_detail:仓库叫「仓库代码」(visible=0 隐藏),**没有仓位**;
 *   · 采购入库行 bl_purchase_in:仓库 + 仓位(列 仓位编码)齐全 —— 链路终点本来就填得下。
 *   ⇒ 仓位在「暂收 / 检验」这两站**无处可存**,才导致入库单只能逐行手填。
 *
 * 本脚本做两件事:
 *   ① 补物理列:sl_recv_detail / qc_insp_detail 加 仓位编码(显示名「仓位」)+ 仓位名称 + 仓位id
 *      (后两个是参照回写用的隐藏列,与采购入库单/采购订单行同构);
 *   ② 补/改字段元数据(yj_field):新增「仓位」参照(WHLOC,按本行仓库级联)与两个隐藏列;
 *      并把 暂收行「仓库」、检验行「仓库代码」由隐藏改为**显示**(用户口径 ③)。
 *
 * 幂等:先判 COL_LENGTH / EXISTS 再动;重复执行不报错。
 * 规范:新增列必须写 MS_Description 中文注明(AGENTS.md 硬要求)。
 * 链路映射:后端 PanelConfigService.FLOW_DETAIL_SYNONYMS 补 仓位 同义词(同批改动)。
 *
 * 执行:两个账套都要跑(HSDZ_MES / HSDZ_MES_TEST)。
 */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ── ① 物理列:送料暂收行 sl_recv_detail ─────────────────────────── */
IF COL_LENGTH('sl_recv_detail', '仓位编码') IS NULL
BEGIN
    ALTER TABLE sl_recv_detail ADD [仓位编码] nvarchar(200) NULL;
    PRINT '[whbin] sl_recv_detail.仓位编码 added';
END ELSE PRINT '[whbin] sl_recv_detail.仓位编码 exists, skip';

IF COL_LENGTH('sl_recv_detail', '仓位名称') IS NULL
BEGIN
    ALTER TABLE sl_recv_detail ADD [仓位名称] nvarchar(400) NULL;
    PRINT '[whbin] sl_recv_detail.仓位名称 added';
END ELSE PRINT '[whbin] sl_recv_detail.仓位名称 exists, skip';

IF COL_LENGTH('sl_recv_detail', '仓位id') IS NULL
BEGIN
    ALTER TABLE sl_recv_detail ADD [仓位id] nvarchar(1000) NULL;
    PRINT '[whbin] sl_recv_detail.仓位id added';
END ELSE PRINT '[whbin] sl_recv_detail.仓位id exists, skip';

/* ── ② 物理列:来料检验行 qc_insp_detail ─────────────────────────── */
IF COL_LENGTH('qc_insp_detail', '仓位编码') IS NULL
BEGIN
    ALTER TABLE qc_insp_detail ADD [仓位编码] nvarchar(200) NULL;
    PRINT '[whbin] qc_insp_detail.仓位编码 added';
END ELSE PRINT '[whbin] qc_insp_detail.仓位编码 exists, skip';

IF COL_LENGTH('qc_insp_detail', '仓位名称') IS NULL
BEGIN
    ALTER TABLE qc_insp_detail ADD [仓位名称] nvarchar(400) NULL;
    PRINT '[whbin] qc_insp_detail.仓位名称 added';
END ELSE PRINT '[whbin] qc_insp_detail.仓位名称 exists, skip';

IF COL_LENGTH('qc_insp_detail', '仓位id') IS NULL
BEGIN
    ALTER TABLE qc_insp_detail ADD [仓位id] nvarchar(1000) NULL;
    PRINT '[whbin] qc_insp_detail.仓位id added';
END ELSE PRINT '[whbin] qc_insp_detail.仓位id exists, skip';

/* ── ③ 中文注明(项目硬规范:新增列必须带 MS_Description)──────────
   写法参照 tools/migrate-table-comments.sql:先删同名扩展属性再补,保证可重复执行。 */
DECLARE @tbl SYSNAME, @col SYSNAME, @desc NVARCHAR(200), @sql NVARCHAR(MAX);

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT * FROM (VALUES
        ('sl_recv_detail', N'仓位编码', N'送料暂收行的仓位编码(界面显示名「仓位」)。由采购订单生单时按行预填;参照仓位档案 WHLOC,按本行仓库级联。'),
        ('sl_recv_detail', N'仓位名称', N'送料暂收行的仓位名称(隐藏辅助列,参照回写用,与采购入库行同构)。'),
        ('sl_recv_detail', N'仓位id',   N'送料暂收行的仓位id(隐藏辅助列,参照回写/反查用)。'),
        ('qc_insp_detail', N'仓位编码', N'来料检验行的仓位编码(界面显示名「仓位」)。随送料暂收单生单带入;参照仓位档案 WHLOC,按本行仓库级联。'),
        ('qc_insp_detail', N'仓位名称', N'来料检验行的仓位名称(隐藏辅助列,参照回写用)。'),
        ('qc_insp_detail', N'仓位id',   N'来料检验行的仓位id(隐藏辅助列,参照回写/反查用)。')
    ) AS v(tbl, col, descr);

OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col, @desc;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(@tbl) AND minor_id = COLUMNPROPERTY(OBJECT_ID(@tbl), @col, 'ColumnId')
                 AND name = N'MS_Description')
    BEGIN
        EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    END
    SET @sql = N'EXEC sp_addextendedproperty N''MS_Description'', @value = N''' + REPLACE(@desc, '''', '''''')
             + N''', @level0type = N''SCHEMA'', @level0name = N''dbo'', @level1type = N''TABLE'', @level1name = N'''
             + @tbl + N''', @level2type = N''COLUMN'', @level2name = N''' + @col + N'''';
    EXEC sp_executesql @sql;
    PRINT '[whbin] MS_Description set: ' + @tbl + '.' + @col;
    FETCH NEXT FROM cur INTO @tbl, @col, @desc;
END
CLOSE cur; DEALLOCATE cur;

/* ── ④ 字段元数据:送料暂收单 QC_RECV ─────────────────────────────
   · 仓库(detail):由隐藏改为显示(用户口径「要把仓库列显示出来」);
   · 仓位(detail):参照仓位档案,按本行「仓库」级联 —— 与采购入库单同一份 ref_filter 写法;
   · 仓位名称 / 仓位id:隐藏辅助列(参照回写用)。 */
DECLARE @n INT;

UPDATE yj_field SET visible = 1, hidden = 0
 WHERE panel_code = N'QC_RECV' AND label = N'仓库' AND place = N'detail';
SET @n = @@ROWCOUNT;
IF @n <> 1
    RAISERROR(N'[whbin] QC_RECV 明细「仓库」行数为 %d,预期 1 行,已中止', 16, 1, @n);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_RECV' AND label = N'仓位' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible, ref_filter, label_en)
    VALUES (N'QC_RECV', N'仓位编码', N'仓位', N'参照', 'WHLOC', N'仓位编码', N'仓位编码',
            N'detail', 375, 120, 1, 0, 0, 1, N'仓库=$仓库', N'Bin');

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_RECV' AND label = N'仓位名称' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_RECV', N'仓位名称', N'仓位名称', N'文本', N'detail', 376, 120, 1, 0, 1, 0);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_RECV' AND label = N'仓位id' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_RECV', N'仓位id', N'仓位id', N'文本', N'detail', 377, 120, 1, 0, 1, 0);

/* ── ⑤ 字段元数据:来料检验单 QC_INSP ─────────────────────────────
   检验行的仓库列叫「仓库代码」,同样由隐藏改为显示;仓位的级联上级就是这一列。 */
UPDATE yj_field SET visible = 1, hidden = 0
 WHERE panel_code = N'QC_INSP' AND label = N'仓库代码' AND place = N'detail';
SET @n = @@ROWCOUNT;
IF @n <> 1
    RAISERROR(N'[whbin] QC_INSP 明细「仓库代码」行数为 %d,预期 1 行,已中止', 16, 1, @n);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP' AND label = N'仓位' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible, ref_filter, label_en)
    VALUES (N'QC_INSP', N'仓位编码', N'仓位', N'参照', 'WHLOC', N'仓位编码', N'仓位编码',
            N'detail', 275, 120, 1, 0, 0, 1, N'仓库=$仓库代码', N'Bin');

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP' AND label = N'仓位名称' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_INSP', N'仓位名称', N'仓位名称', N'文本', N'detail', 276, 120, 1, 0, 1, 0);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP' AND label = N'仓位id' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_INSP', N'仓位id', N'仓位id', N'文本', N'detail', 277, 120, 1, 0, 1, 0);

/* ── ⑥ 多语言(AGENTS.md 多语言强制规范:新增字段必须同时给译名)──── */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'仓位' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'仓位', N'en', N'Bin', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'仓位名称' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'仓位名称', N'en', N'Bin name', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'仓位id' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'仓位id', N'en', N'Bin ID', N'manual');

/* ── ⑦ 自检:两表各三列都在、两个面板各有一行可见「仓位」 ────────── */
DECLARE @missing INT = 0;
IF COL_LENGTH('sl_recv_detail', '仓位编码') IS NULL OR COL_LENGTH('sl_recv_detail', '仓位名称') IS NULL
   OR COL_LENGTH('sl_recv_detail', '仓位id') IS NULL SET @missing = @missing + 1;
IF COL_LENGTH('qc_insp_detail', '仓位编码') IS NULL OR COL_LENGTH('qc_insp_detail', '仓位名称') IS NULL
   OR COL_LENGTH('qc_insp_detail', '仓位id') IS NULL SET @missing = @missing + 1;
IF @missing > 0
BEGIN
    RAISERROR(N'[whbin] 自检失败:仍有 %d 张表缺仓位列', 16, 1, @missing);
    RETURN;
END

DECLARE @fld INT = (SELECT COUNT(*) FROM yj_field WHERE label = N'仓位' AND place = N'detail'
                    AND visible = 1 AND panel_code IN (N'QC_RECV', N'QC_INSP'));
IF @fld <> 2
    RAISERROR(N'[whbin] 自检失败:暂收/检验的可见「仓位」字段行数为 %d,预期 2 行', 16, 1, @fld);

PRINT '[whbin] 自检通过:仓位列与字段元数据就位(QC_RECV / QC_INSP)。';
