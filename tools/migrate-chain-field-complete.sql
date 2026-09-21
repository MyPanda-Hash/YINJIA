/* ============================================================================
 * 采购链字段流转修复 ③:单据日期统一 + 暂收单补字段 + 采购入库单补完整
 * ----------------------------------------------------------------------------
 * 用户口径(2026-09-21):
 *   ①「单据日期全改为单据日期」——表头日期字段的标签统一叫「单据日期」(列名不动)。
 *   ② 入库单用「采购订单号」做来源即可(不补 外部单据号/来源单据/来源单号 三个死列)。
 *   ③「需要补充,并且保证采购入库单完整」——入库单缺的列/字段补齐。
 *   ⑤「暂收单需要带有的字段补充完整」——送料暂收单明细把采购订单能给、业务要看的字段补齐。
 *
 * 本脚本(幂等):
 *   ① yj_field 表头位 label=日期 → 单据日期(QC_RECV/RD_SPEC_DOC/WLBOM);
 *   ② sl_recv_detail 补 8 列(数量2/计量单位2/税率%/含税单价/含税金额/折扣%/预计到货日期/现存量)
 *      + 注册字段(place=detail)——它们与采购订单行**同名**,采购订单→暂收单的同名映射自动带过来;
 *   ③ bl_purchase_in 补 3 列(送检数量/部门名称/生产日期)+ 注册字段;「备注」补明细位登记(行备注);
 *   ④ qc_insp 补登记 供应商代码/业务员 两个头字段;部门/部门名称/仓库 扩到 header 位(镜像同步与映射要写头);
 *   ⑤ 新增列写 MS_Description 中文注明;⑥ 自检。
 * 配套代码(同提交):
 *   · ButtonService.inspAutoPurchaseIn:行带 送检数量/部门名称/生产日期,仓库行空时用检验头仓库兜底;
 *   · ButtonService.inspAutoReturn:退回头日期标签 日期 → 单据日期;退回行补 单位;
 *   · PanelConfigService:QC_INSP|PURCHASE_IN 增 {供应商代码 → 供应商编码};清理已失效的日期同义词。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 表头日期统一为「单据日期」 ---------- */
UPDATE yj_field SET label = N'单据日期'
 WHERE label = N'日期' AND place LIKE '%header%';
PRINT N'表头日期标签统一: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ② 送料暂收单明细补字段(与采购订单行同名,映射直接带过来) ---------- */
IF COL_LENGTH('dbo.sl_recv_detail', N'数量2') IS NULL ALTER TABLE dbo.sl_recv_detail ADD [数量2] decimal(18,4) NULL;
IF COL_LENGTH('dbo.sl_recv_detail', N'计量单位2') IS NULL ALTER TABLE dbo.sl_recv_detail ADD [计量单位2] nvarchar(100) NULL;
IF COL_LENGTH('dbo.sl_recv_detail', N'税率%') IS NULL ALTER TABLE dbo.sl_recv_detail ADD [税率%] decimal(18,4) NULL;
IF COL_LENGTH('dbo.sl_recv_detail', N'含税单价') IS NULL ALTER TABLE dbo.sl_recv_detail ADD [含税单价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.sl_recv_detail', N'含税金额') IS NULL ALTER TABLE dbo.sl_recv_detail ADD [含税金额] decimal(18,4) NULL;
IF COL_LENGTH('dbo.sl_recv_detail', N'折扣%') IS NULL ALTER TABLE dbo.sl_recv_detail ADD [折扣%] decimal(18,4) NULL;
IF COL_LENGTH('dbo.sl_recv_detail', N'预计到货日期') IS NULL ALTER TABLE dbo.sl_recv_detail ADD [预计到货日期] date NULL;
IF COL_LENGTH('dbo.sl_recv_detail', N'现存量') IS NULL ALTER TABLE dbo.sl_recv_detail ADD [现存量] decimal(18,4) NULL;
GO

DECLARE @f1 TABLE (col NVARCHAR(100), type NVARCHAR(20), seq INT, width INT, vis BIT);
INSERT INTO @f1 VALUES
 (N'数量2', N'小数', 380, 90, 1), (N'计量单位2', N'文本', 390, 90, 1),
 (N'税率%', N'小数', 400, 80, 1), (N'含税单价', N'小数', 410, 100, 1),
 (N'含税金额', N'小数', 420, 100, 1), (N'折扣%', N'小数', 430, 80, 1),
 (N'预计到货日期', N'日期', 440, 120, 1), (N'现存量', N'小数', 450, 90, 0);
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'QC_RECV', f.col, f.col, f.type, NULL, NULL, NULL, NULL, 'detail', f.seq, f.width, 1, 0, 0, f.vis
FROM @f1 f
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code='QC_RECV' AND x.col_name=f.col);
PRINT N'送料暂收单明细补字段: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ③ 采购入库单补齐(列 + 字段) ---------- */
IF COL_LENGTH('dbo.bl_purchase_in', N'送检数量') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [送检数量] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bl_purchase_in', N'部门名称') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [部门名称] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bl_purchase_in', N'生产日期') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [生产日期] nvarchar(20) NULL;
GO

DECLARE @f2 TABLE (col NVARCHAR(100), type NVARCHAR(20), seq INT, width INT);
INSERT INTO @f2 VALUES (N'送检数量', N'小数', 990, 100), (N'部门名称', N'文本', 995, 120), (N'生产日期', N'文本', 1000, 110);
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'PURCHASE_IN', f.col, f.col, f.type, NULL, NULL, NULL, NULL, 'detail', f.seq, f.width, 0, 0, 0, 1
FROM @f2 f
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code='PURCHASE_IN' AND x.col_name=f.col);

/* 「备注」在 PURCHASE_IN 只有表头位 → 补一条明细位登记,行备注才能随链带入(label 同名,列同名,互不冲突) */
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'PURCHASE_IN', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 1005, 200, 0, 0, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code='PURCHASE_IN' AND x.col_name=N'备注' AND x.place LIKE '%detail%');
PRINT N'采购入库单补字段: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(含行备注)';
GO

/* ---------- ④ 来料检验单:补登记头字段 + 把部门/部门名称/仓库 扩到表头位 ---------- */
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT v.panel, v.col, v.label, v.type, v.dict, v.refp, v.reff, v.disp, v.place, v.seq, v.width, 1, 0, 0, v.vis
FROM (VALUES
    ('QC_INSP', N'供应商代码', N'供应商代码', N'文本', NULL, NULL, NULL, NULL, N'query,header', 50, 130, CAST(1 AS bit)),
    ('QC_INSP', N'业务员',     N'业务员',     N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'header',       60, 100, CAST(1 AS bit))
) v(panel, col, label, type, dict, refp, reff, disp, place, seq, width, vis)
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code=v.panel AND x.col_name=v.col AND x.place LIKE '%header%');

-- 部门/部门名称/仓库:已登记但只在明细位 → 扩到表头位(镜像同步与头映射要写表头)
UPDATE yj_field SET place = N'header,detail'
 WHERE panel_code = 'QC_INSP' AND col_name IN (N'部门', N'部门名称', N'仓库')
   AND place LIKE '%detail%' AND place NOT LIKE '%header%';
PRINT N'来料检验单头字段补齐: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ③b 行级仓库贯通:暂收行补 仓库 列,检验行登记 仓库代码 ---------- */
IF COL_LENGTH('dbo.sl_recv_detail', N'仓库') IS NULL ALTER TABLE dbo.sl_recv_detail ADD [仓库] nvarchar(100) NULL;
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'QC_RECV', N'仓库', N'仓库', N'文本', NULL, NULL, NULL, NULL, N'detail', 460, 120, 1, 0, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code='QC_RECV' AND x.col_name=N'仓库' AND x.place LIKE '%detail%');
/* 检验行 仓库代码 登记(此前无字段行,故采购订单/暂收行的仓库到检验这一跳断掉) */
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'QC_INSP', N'仓库代码', N'仓库代码', N'文本', NULL, NULL, NULL, NULL, N'detail', 260, 120, 1, 0, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code='QC_INSP' AND x.col_name=N'仓库代码');
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.sl_recv_detail') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'), N'仓库', 'ColumnId') AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'仓库(采购订单行同名带入,行级仓库沿链 暂收→检验→入库 贯通)', N'SCHEMA', N'dbo', N'TABLE', N'sl_recv_detail', N'COLUMN', N'仓库';
GO
/* ---------- ⑤ 新增列中文注明 ---------- */
DECLARE @cm TABLE (tbl SYSNAME, col SYSNAME, txt NVARCHAR(400));
INSERT INTO @cm VALUES
 ('sl_recv_detail', N'数量2',      N'辅助数量(采购订单行同名带入)'),
 ('sl_recv_detail', N'计量单位2',  N'辅助计量单位(采购订单行同名带入)'),
 ('sl_recv_detail', N'税率%',      N'税率(采购订单行同名带入)'),
 ('sl_recv_detail', N'含税单价',   N'含税单价(采购订单行同名带入)'),
 ('sl_recv_detail', N'含税金额',   N'含税金额(采购订单行同名带入)'),
 ('sl_recv_detail', N'折扣%',      N'折扣率(采购订单行同名带入)'),
 ('sl_recv_detail', N'预计到货日期', N'预计到货日期(采购订单行同名带入)'),
 ('sl_recv_detail', N'现存量',     N'现存量(采购订单行同名带入,默认隐藏)'),
 ('bl_purchase_in', N'送检数量',   N'送检数量(来源来料检验单,2026-09-21 补齐)'),
 ('bl_purchase_in', N'部门名称',   N'部门名称(来源来料检验单,2026-09-21 补齐)'),
 ('bl_purchase_in', N'生产日期',   N'生产日期(来源来料检验单,2026-09-21 补齐)');
DECLARE @t SYSNAME, @c SYSNAME, @x NVARCHAR(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, txt FROM @cm;
OPEN cur; FETCH NEXT FROM cur INTO @t, @c, @x;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH('dbo.' + @t, @c) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.' + @t) AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.' + @t), @c, 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @x, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @t, @c, @x;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'列中文注明已补';
GO

/* ---------- ⑥ 自检 ---------- */
IF EXISTS (SELECT 1 FROM yj_field WHERE label = N'日期' AND place LIKE '%header%')
    RAISERROR(N'仍有表头字段标签为「日期」', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RECV' AND col_name IN (N'数量2',N'计量单位2',N'税率%',N'含税单价',N'含税金额',N'折扣%',N'预计到货日期',N'现存量')) <> 8
    RAISERROR(N'送料暂收单新增字段未满 8 个', 16, 1);
IF COL_LENGTH('dbo.bl_purchase_in', N'送检数量') IS NULL OR COL_LENGTH('dbo.bl_purchase_in', N'部门名称') IS NULL OR COL_LENGTH('dbo.bl_purchase_in', N'生产日期') IS NULL
    RAISERROR(N'采购入库单缺列', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_INSP' AND col_name IN (N'供应商代码',N'业务员') AND place LIKE '%header%') <> 2
    RAISERROR(N'来料检验单头 供应商代码/业务员 未登记', 16, 1);
PRINT N'✅ 单据日期统一 / 送料暂收单补字段 / 采购入库单补齐 完成';
GO
