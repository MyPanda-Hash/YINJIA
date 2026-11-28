/* ============================================================================
   仓位(金蝶 sp / 库位)字段接通 —— 2026-12-01

   【为什么要这个脚本】
   金蝶云·星辰那边持有两件东西:①仓库档案的「启用仓位管理」(`is_allow_freight`)
   ②仓位档案(sp);MES 这边是**单据来源**(转 ERP 把单据推上去)。现状实测(2026-12-01):
     · HSDZ_MES.bs_wh.启用仓位管理 10 个仓全 0/NULL(从金蝶同步下来的,金蝶侧也是全 false);
     · 单据行「仓位」填写:采购入库 979 行 / 销售出库 1198 / 材料出库 2109 / 采购订单 5289 —— **全 0 行**;
     · 转 ERP(KingdeePushService)此前只推仓库,不推仓位 ⇒ 已补 sp_id/sp_number(2026-12-01 代码改动)。
   本脚本只补「字段层」:让该带仓位的单据**能录、能显示、能随单推出去**。
   不动采购入库/暂收/来料检验/暂收退料(采购链四单基线,见《采购链四单字段与显示字段.md》)。

   【三条】
   ① 产品入库/其他入库/其他出库 三张行表补 仓位编码/仓位id/仓位名称 三列(幂等,已存在则跳过);
   ② 上述三张面板登记明细「仓位」字段(参照 WHLOC.仓位编码,按本行「仓库」级联);
   ③ 材料出库/销售出库/销售退货/生产退料 四张面板的「仓位编码」字段:隐藏 → 可见参照;
   ④ 中文注明(MS_Description)+ 末尾自检(三态:缺表跳过 / 存在但没改成功 RAISERROR / 成功 PRINT)。

   【口径】
   · 仓位在 MES 只是**单据留痕**:kucun/inh/outh 的记账键是 (物料, 仓库, 批号),没有仓位维度;
   · 金蝶保存接口只认 sp_id(仓位档案无开放接口,sp_id 由 KingdeePushService.spIdOf 反查);
   · 层级:仓位必须属于本行仓库 —— 参照级联 `仓库=$仓库`,与采购入库单逐字同款。
   ============================================================================ */
SET NOCOUNT ON;
GO

/* ── ① 三张行表补仓位列(类型对齐 bl_purchase_in:编码/id 500、名称 200)── */
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'仓位编码') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [仓位编码] nvarchar(500) NULL;
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'仓位id') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [仓位id] nvarchar(500) NULL;
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'仓位名称') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [仓位名称] nvarchar(200) NULL;

IF OBJECT_ID(N'dbo.bl_other_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_other_in', N'仓位编码') IS NULL
    ALTER TABLE dbo.bl_other_in ADD [仓位编码] nvarchar(500) NULL;
IF OBJECT_ID(N'dbo.bl_other_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_other_in', N'仓位id') IS NULL
    ALTER TABLE dbo.bl_other_in ADD [仓位id] nvarchar(500) NULL;
IF OBJECT_ID(N'dbo.bl_other_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_other_in', N'仓位名称') IS NULL
    ALTER TABLE dbo.bl_other_in ADD [仓位名称] nvarchar(200) NULL;

IF OBJECT_ID(N'dbo.bl_other_out', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_other_out', N'仓位编码') IS NULL
    ALTER TABLE dbo.bl_other_out ADD [仓位编码] nvarchar(500) NULL;
IF OBJECT_ID(N'dbo.bl_other_out', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_other_out', N'仓位id') IS NULL
    ALTER TABLE dbo.bl_other_out ADD [仓位id] nvarchar(500) NULL;
IF OBJECT_ID(N'dbo.bl_other_out', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_other_out', N'仓位名称') IS NULL
    ALTER TABLE dbo.bl_other_out ADD [仓位名称] nvarchar(200) NULL;
GO

/* ── ② 新列中文注明(幂等)── */
IF COL_LENGTH(N'dbo.bl_finish_in', N'仓位编码') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_finish_in')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'仓位编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'仓位编码(bs_wh_loc.仓位编码;必须属于本行「仓库」且未停用;金蝶保存接口只认 sp_id,转ERP 按此编码反查)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'仓位编码';
IF COL_LENGTH(N'dbo.bl_finish_in', N'仓位id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_finish_in')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'仓位id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓位id(金蝶 sp_id;仅留痕/反查,不参与 MES 记账)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'仓位id';
IF COL_LENGTH(N'dbo.bl_finish_in', N'仓位名称') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_finish_in')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'仓位名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓位名称(展示用,可空;以仓位编码为准)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'仓位名称';

IF COL_LENGTH(N'dbo.bl_other_in', N'仓位编码') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_other_in')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'仓位编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'仓位编码(bs_wh_loc.仓位编码;必须属于本行「仓库」且未停用;金蝶保存接口只认 sp_id,转ERP 按此编码反查)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'仓位编码';
IF COL_LENGTH(N'dbo.bl_other_in', N'仓位id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_other_in')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'仓位id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓位id(金蝶 sp_id;仅留痕/反查,不参与 MES 记账)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'仓位id';
IF COL_LENGTH(N'dbo.bl_other_in', N'仓位名称') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_other_in')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'仓位名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓位名称(展示用,可空;以仓位编码为准)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'仓位名称';

IF COL_LENGTH(N'dbo.bl_other_out', N'仓位编码') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_other_out')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'仓位编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'仓位编码(bs_wh_loc.仓位编码;必须属于本行「仓库」且未停用;金蝶保存接口只认 sp_id,转ERP 按此编码反查)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'仓位编码';
IF COL_LENGTH(N'dbo.bl_other_out', N'仓位id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_other_out')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'仓位id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓位id(金蝶 sp_id;仅留痕/反查,不参与 MES 记账)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'仓位id';
IF COL_LENGTH(N'dbo.bl_other_out', N'仓位名称') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_other_out')
        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'仓位名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓位名称(展示用,可空;以仓位编码为准)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'仓位名称';
GO

/* ── ③ 三张面板登记明细「仓位」字段(参照 WHLOC.仓位编码,按行仓库级联)── */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'FINISH_IN' AND place = N'detail' AND label = N'仓位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key)
VALUES (N'FINISH_IN', N'仓位编码', N'仓位', N'参照', NULL, N'WHLOC', N'仓位编码', N'仓位编码',
        N'detail', 125, 120, 1, 0, 0, NULL, 1, NULL, NULL, N'仓库=$仓库', NULL);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'OTHER_IN' AND place = N'detail' AND label = N'仓位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key)
VALUES (N'OTHER_IN', N'仓位编码', N'仓位', N'参照', NULL, N'WHLOC', N'仓位编码', N'仓位编码',
        N'detail', 110, 120, 1, 0, 0, NULL, 1, NULL, NULL, N'仓库=$仓库', NULL);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'OTHER_OUT' AND place = N'detail' AND label = N'仓位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key)
VALUES (N'OTHER_OUT', N'仓位编码', N'仓位', N'参照', NULL, N'WHLOC', N'仓位编码', N'仓位编码',
        N'detail', 100, 120, 1, 0, 0, NULL, 1, NULL, NULL, N'仓库=$仓库', NULL);
GO

/* ── ④ 四张面板的「仓位编码」字段:隐藏 → 可见参照(标签不动,数据键不迁移)── */
UPDATE yj_field
   SET data_type     = N'参照',
       ref_panel     = N'WHLOC',
       ref_field     = N'仓位编码',
       display_field = N'仓位编码',
       ref_filter    = N'仓库=$仓库',
       hidden        = 0,
       visible       = 1,
       width         = CASE WHEN ISNULL(width, 0) < 120 THEN 120 ELSE width END
 WHERE panel_code IN (N'MATERIAL_OUT', N'SALE_OUT', N'SALE_IN', N'MATERIAL_RET')
   AND place = N'detail'
   AND label = N'仓位编码';
GO

/* ── ⑤ 自检(三态)──
   缺列 ⇒ 该面板结构不同源,提示跳过(不中断整链路);
   列在但字段没登记 / 字段没转参照 ⇒ RAISERROR,让 DbSync 判这次没执行成功;
   全绿 ⇒ PRINT 一行汇总,便于在迁移日志里核对。 */
DECLARE @miss nvarchar(400) = N'';
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'仓位编码') IS NULL SET @miss += N'bl_finish_in.仓位编码 ';
IF OBJECT_ID(N'dbo.bl_other_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_other_in', N'仓位编码') IS NULL SET @miss += N'bl_other_in.仓位编码 ';
IF OBJECT_ID(N'dbo.bl_other_out', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_other_out', N'仓位编码') IS NULL SET @miss += N'bl_other_out.仓位编码 ';

IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'FINISH_IN' AND place = N'detail' AND label = N'仓位')
    SET @miss += N'FINISH_IN 缺「仓位」字段 ';
IF OBJECT_ID(N'dbo.bl_other_in', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'OTHER_IN' AND place = N'detail' AND label = N'仓位')
    SET @miss += N'OTHER_IN 缺「仓位」字段 ';
IF OBJECT_ID(N'dbo.bl_other_out', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'OTHER_OUT' AND place = N'detail' AND label = N'仓位')
    SET @miss += N'OTHER_OUT 缺「仓位」字段 ';

IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'MATERIAL_OUT', N'SALE_OUT', N'SALE_IN', N'MATERIAL_RET')
        AND place = N'detail' AND label = N'仓位编码' AND ref_panel = N'WHLOC' AND hidden = 0 AND visible = 1) <> 4
    SET @miss += N'4 张出库/退货单的仓位字段没全部转成可见参照 ';

IF @miss <> N''
BEGIN
    RAISERROR(N'[仓位字段接通] 自检未通过: %s', 16, 1, @miss);
END
ELSE
BEGIN
    PRINT N'[仓位字段接通] 自检通过:3 张行表仓位列齐 / 3 个新字段已登记 / 4 个仓位字段已转为可见参照';
END
GO
