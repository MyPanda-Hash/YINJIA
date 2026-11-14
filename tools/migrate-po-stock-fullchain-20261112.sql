/* ============================================================================
 * migrate-po-stock-fullchain-20261112.sql
 * 采购链「现存量」字段贯通:来料检验单 / 暂收退回单 / 特采单补隐藏字段 + 存量回填
 * ----------------------------------------------------------------------------
 * 【用户口径(2026-11-12)】
 *   「采购订单的现存量字段,MES 里有没有记录?如果有,需要让这个字段从
 *     采购订单 → 送料暂收单 → 采购入库 全流程都有这个信息(中间可能有检验、退料、特采);
 *     可以隐藏这个字段,但要保留字段全流程存在。」
 *
 * 【口径前提(2026-11-12 实测,见 deploy/金蝶采购订单现存量口径.md)】
 *   金蝶采购订单行的 `inv_qty`(库存数量/现存量)是**制单时的库存快照**,不是实时库存
 *   (同一物料 49 张跨 19 个月的单,同一时刻读到 49 个不同值;行上无仓库 = 全仓合计)。
 *   所以本字段沿链只作**追溯参考**,不得用于可用量/缺料/库存对账;实时库存看 kucun。
 *
 * 【本次改什么(只加列 + 登记隐藏字段,不动任何既有值)】
 *   ① 物理列:qc_insp_detail.现存量 / qc_return_detail.现存量 / qc_tc_in.现存量
 *      (均为 decimal(18,4) NULL,与 bl_pu_order.现存量 / sl_recv_detail.现存量 / bl_purchase_in.现存量 同型);
 *   ② yj_field 登记(全部 hidden=1、visible=0、editable=0 —— 用户口径「可以隐藏」):
 *        QC_INSP   明细 seq 265(入库单号 260 与 仓库代码 270 之间)
 *        QC_RETURN 明细 seq 105(采购订单行号 100 与 不良原因 110 之间)
 *        QC_TC_IN  表头 seq 66(总数量 60 / 计量单位 65 之后;特采单一物料一单,只有表头)
 *   ③ 译名:标签「现存量」全局已有 10 语言(yj_translation scope='field'),无需新增,脚本内只做兜底补齐;
 *   ④ 存量回填(只填 NULL,按 采购订单号+采购订单行号 这条链上的同一口径):
 *        暂收行 ← 采购订单行          检验行 ← 采购订单行
 *        退回行 ← 采购订单行(缺则 ← 检验行 检验单号+物料编码)
 *        特采头 ← 暂收退料单行(缺则 ← 检验行)
 *        入库行 ← 采购订单行(缺则 ← 来料检验行 入库单号+物料编码、再 ← 暂收行 来源单号+行号+物料)
 *
 * 【为什么用隐藏字段而不是只留在采购订单上】
 *   用户要的是「全流程都有」:任一站都能看到这批货下单时的库存口径,而不用回采购订单翻。
 *   隐藏 = 不占表格列、不干扰录入,但值仍在、仍参与链路映射(PanelConfigService 的同名/同义词映射不看 hidden)。
 *
 * 【幂等】加列/注明/字段登记/译名/回填全部带存在性守卫;重跑行数为 0。
 * 【两账套】HSDZ_MES → HSDZ_MES_TEST(先正式后测试)。
 * ========================================================================== */
SET NOCOUNT ON;
PRINT N'== migrate-po-stock-fullchain-20261112 ==';

/* ══════════════════ A. 物理列 ══════════════════ */
IF COL_LENGTH(N'dbo.qc_insp_detail', N'现存量') IS NULL
BEGIN
  ALTER TABLE dbo.qc_insp_detail ADD [现存量] decimal(18,4) NULL;
  PRINT N'[OK] qc_insp_detail +1 列:现存量 decimal(18,4)';
END
ELSE PRINT N'[SKIP] qc_insp_detail.现存量 已存在';

IF COL_LENGTH(N'dbo.qc_return_detail', N'现存量') IS NULL
BEGIN
  ALTER TABLE dbo.qc_return_detail ADD [现存量] decimal(18,4) NULL;
  PRINT N'[OK] qc_return_detail +1 列:现存量 decimal(18,4)';
END
ELSE PRINT N'[SKIP] qc_return_detail.现存量 已存在';

IF COL_LENGTH(N'dbo.qc_tc_in', N'现存量') IS NULL
BEGIN
  ALTER TABLE dbo.qc_tc_in ADD [现存量] decimal(18,4) NULL;
  PRINT N'[OK] qc_tc_in +1 列:现存量 decimal(18,4)';
END
ELSE PRINT N'[SKIP] qc_tc_in.现存量 已存在';
GO

/* ══════════════════ B. 列级中文注明(MS_Description) ══════════════════ */
DECLARE @c1 nvarchar(600) = N'现存量(采购链透传字段,2026-11-12 新增,隐藏):采购订单行上的库存快照 —— '
  + N'金蝶 inv_qty 在**制单那一刻**的库存数量(行上无仓库 = 全仓合计),不是实时库存;'
  + N'沿 采购订单→送料暂收→来料检验 逐站下传,仅供追溯,不可用于可用量/缺料判断。实时库存见 kucun。';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_insp_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_insp_detail'), N'现存量', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description', @c1, N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_detail', N'COLUMN', N'现存量';
ELSE
  EXEC sp_updateextendedproperty N'MS_Description', @c1, N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_detail', N'COLUMN', N'现存量';

DECLARE @c2 nvarchar(600) = N'现存量(采购链透传字段,2026-11-12 新增,隐藏):采购订单行上的库存快照 —— '
  + N'金蝶 inv_qty 在**制单那一刻**的库存数量(行上无仓库 = 全仓合计),不是实时库存;'
  + N'沿 采购订单→送料暂收→来料检验→暂收退回 逐站下传(退料行由检验行镜像),仅供追溯。实时库存见 kucun。';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_return_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_return_detail'), N'现存量', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description', @c2, N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'现存量';
ELSE
  EXEC sp_updateextendedproperty N'MS_Description', @c2, N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'现存量';

DECLARE @c3 nvarchar(600) = N'现存量(采购链透传字段,2026-11-12 新增,隐藏):特采单是**一物料一单**、只有表头,'
  + N'故本列落在表头 —— 值来自 暂收退料单行的现存量(缺失时取来源检验行),即采购订单制单时的库存快照,'
  + N'不是实时库存;特采审批后生成的采购入库行继续带同一个值。实时库存见 kucun。';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_tc_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_tc_in'), N'现存量', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description', @c3, N'SCHEMA', N'dbo', N'TABLE', N'qc_tc_in', N'COLUMN', N'现存量';
ELSE
  EXEC sp_updateextendedproperty N'MS_Description', @c3, N'SCHEMA', N'dbo', N'TABLE', N'qc_tc_in', N'COLUMN', N'现存量';
PRINT N'[OK] 三列列级注明已写入';
GO

/* ══════════════════ C. yj_field 登记(隐藏,不改表格) ══════════════════ */
/* C1. 来料检验单 · 明细(seq 265:入库单号 260 与 仓库代码 270 之间) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP' AND col_name = N'现存量')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_INSP', N'现存量', N'现存量', N'Current inventory', N'小数', N'detail', 265, 100, 0, 0, 1, 0);
ELSE
  UPDATE yj_field SET label = N'现存量', label_en = N'Current inventory', data_type = N'小数', place = N'detail', seq = 265,
         width = 100, editable = 0, required = 0, hidden = 1, visible = 0
   WHERE panel_code = N'QC_INSP' AND col_name = N'现存量';

/* C2. 暂收退回单 · 明细(seq 105:采购订单行号 100 与 不良原因 110 之间) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_RETURN' AND col_name = N'现存量')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_RETURN', N'现存量', N'现存量', N'Current inventory', N'小数', N'detail', 105, 100, 0, 0, 1, 0);
ELSE
  UPDATE yj_field SET label = N'现存量', label_en = N'Current inventory', data_type = N'小数', place = N'detail', seq = 105,
         width = 100, editable = 0, required = 0, hidden = 1, visible = 0
   WHERE panel_code = N'QC_RETURN' AND col_name = N'现存量';

/* C3. 特采单 · 表头(seq 66:总数量 60 / 计量单位 65 之后;一物料一单,无明细) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_TC_IN' AND col_name = N'现存量')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_TC_IN', N'现存量', N'现存量', N'Current inventory', N'小数', N'header', 66, 100, 0, 0, 1, 0);
ELSE
  UPDATE yj_field SET label = N'现存量', label_en = N'Current inventory', data_type = N'小数', place = N'header', seq = 66,
         width = 100, editable = 0, required = 0, hidden = 1, visible = 0
   WHERE panel_code = N'QC_TC_IN' AND col_name = N'现存量';

/* C4. 送料暂收单的现存量(2026-09-22 起就在,一直没写 label_en)补齐英文名,四单口径一致 */
UPDATE yj_field SET label_en = N'Current inventory'
 WHERE panel_code = N'QC_RECV' AND col_name = N'现存量' AND ISNULL(label_en, N'') = N'';
PRINT N'[OK] yj_field 就绪:QC_INSP(明细265) / QC_RETURN(明细105) / QC_TC_IN(表头66),均 hidden=1 visible=0';
GO

/* ══════════════════ D. 译名兜底(标签「现存量」全局共享,通常已有 10 语言) ══════════════════ */
DECLARE @tr TABLE (locale varchar(10), text nvarchar(200));
INSERT INTO @tr VALUES
 ('en', N'Current inventory'),
 ('ja', N'現存量'),
 ('ko', N'현재 재고'),
 ('de', N'Aktueller Bestand'),
 ('fr', N'Stock actuel'),
 ('es', N'Existencial'),
 ('ru', N'Текущий запас'),
 ('th', N'สต็อก'),
 ('vi', N'Lượng tồn hiện tại'),
 ('zh-TW', N'現存量');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', N'现存量', t.locale, t.text, N'manual'
FROM @tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                   WHERE x.scope = N'field' AND x.ref_key = N'现存量' AND x.locale = t.locale);
PRINT N'[OK] 译名兜底补齐行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ══════════════════ E. 存量回填(只填 NULL;口径 = 采购订单行) ══════════════════ */
/* E1. 送料暂收行 ← 采购订单行(头 采购订单号 + 行 采购订单行号) */
UPDATE d SET d.现存量 = x.v
FROM sl_recv_detail d
JOIN sl_recv h ON h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel, 'N') <> 'Y'
CROSS APPLY (SELECT TOP 1 o.现存量 AS v FROM bl_pu_order o
              WHERE o.单据编号 = h.采购订单号
                AND LTRIM(RTRIM(o.行号)) = LTRIM(RTRIM(d.采购订单行号))
                AND o.现存量 IS NOT NULL
              ORDER BY o.id) x
WHERE d.现存量 IS NULL AND ISNULL(d.asp_cancel, 'N') <> 'Y';
PRINT N'[回填] 送料暂收行 ← 采购订单行 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* E2. 来料检验行 ← 采购订单行(头 采购订单号 + 行 采购订单行号) */
UPDATE d SET d.现存量 = x.v
FROM qc_insp_detail d
JOIN qc_insp h ON h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel, 'N') <> 'Y'
CROSS APPLY (SELECT TOP 1 o.现存量 AS v FROM bl_pu_order o
              WHERE o.单据编号 = h.采购订单号
                AND LTRIM(RTRIM(o.行号)) = LTRIM(RTRIM(d.采购订单行号))
                AND o.现存量 IS NOT NULL
              ORDER BY o.id) x
WHERE d.现存量 IS NULL AND ISNULL(d.asp_cancel, 'N') <> 'Y';
PRINT N'[回填] 来料检验行 ← 采购订单行 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* E3. 暂收退回行 ← 采购订单行;仍空则 ← 来料检验行(检验单号 + 物料编码) */
UPDATE d SET d.现存量 = x.v
FROM qc_return_detail d
JOIN qc_return h ON h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel, 'N') <> 'Y'
CROSS APPLY (SELECT TOP 1 o.现存量 AS v FROM bl_pu_order o
              WHERE o.单据编号 = h.采购订单号
                AND LTRIM(RTRIM(o.行号)) = LTRIM(RTRIM(d.采购订单行号))
                AND o.现存量 IS NOT NULL
              ORDER BY o.id) x
WHERE d.现存量 IS NULL AND ISNULL(d.asp_cancel, 'N') <> 'Y';
PRINT N'[回填] 暂收退回行 ← 采购订单行 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE d SET d.现存量 = x.v
FROM qc_return_detail d
JOIN qc_return h ON h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel, 'N') <> 'Y'
CROSS APPLY (SELECT TOP 1 i.现存量 AS v FROM qc_insp_detail i
              WHERE i.单据编号 = h.检验单号 AND i.物料编码 = d.物料编码
                AND ISNULL(i.asp_cancel, 'N') <> 'Y' AND i.现存量 IS NOT NULL
              ORDER BY i.id) x
WHERE d.现存量 IS NULL AND ISNULL(d.asp_cancel, 'N') <> 'Y';
PRINT N'[回填] 暂收退回行 ← 来料检验行 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* E4. 特采单头 ← 暂收退料单行(暂收退料单号 + 产品名称=物料名称);仍空则 ← 检验行(检验单号 + 产品名称) */
UPDATE t SET t.现存量 = x.v
FROM qc_tc_in t
CROSS APPLY (SELECT TOP 1 r.现存量 AS v FROM qc_return_detail r
              WHERE r.单据编号 = t.暂收退料单号 AND r.物料名称 = t.产品名称
                AND ISNULL(r.asp_cancel, 'N') <> 'Y' AND r.现存量 IS NOT NULL
              ORDER BY r.id) x
WHERE t.现存量 IS NULL AND ISNULL(t.asp_cancel, 'N') <> 'Y';
PRINT N'[回填] 特采单头 ← 暂收退料行 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE t SET t.现存量 = x.v
FROM qc_tc_in t
CROSS APPLY (SELECT TOP 1 i.现存量 AS v FROM qc_insp_detail i
              WHERE i.单据编号 = t.检验单号 AND i.物料名称 = t.产品名称
                AND ISNULL(i.asp_cancel, 'N') <> 'Y' AND i.现存量 IS NOT NULL
              ORDER BY i.id) x
WHERE t.现存量 IS NULL AND ISNULL(t.asp_cancel, 'N') <> 'Y';
PRINT N'[回填] 特采单头 ← 检验行 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* E5. 采购入库行 ← 来料检验行(检验行 入库单号 = 入库单号 + 物料编码);仍空则 ← 采购订单行;再 ← 暂收行 */
UPDATE p SET p.现存量 = x.v
FROM bl_purchase_in p
CROSS APPLY (SELECT TOP 1 i.现存量 AS v FROM qc_insp_detail i
              WHERE i.入库单号 = p.单据编号 AND i.物料编码 = p.存货编码
                AND ISNULL(i.asp_cancel, 'N') <> 'Y' AND i.现存量 IS NOT NULL
              ORDER BY i.id) x
WHERE p.现存量 IS NULL AND ISNULL(p.asp_cancel, 'N') <> 'Y';
PRINT N'[回填] 采购入库行 ← 来料检验行 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE p SET p.现存量 = x.v
FROM bl_purchase_in p
JOIN bd_purchase_in h ON h.单据编号 = p.单据编号 AND ISNULL(h.asp_cancel, 'N') <> 'Y'
CROSS APPLY (SELECT TOP 1 o.现存量 AS v FROM bl_pu_order o
              WHERE o.单据编号 = h.采购订单号
                AND LTRIM(RTRIM(o.行号)) = LTRIM(RTRIM(p.源单行号))
                AND LTRIM(RTRIM(o.物料编码)) = LTRIM(RTRIM(p.存货编码))
                AND o.现存量 IS NOT NULL
              ORDER BY o.id) x
WHERE p.现存量 IS NULL AND ISNULL(p.asp_cancel, 'N') <> 'Y';
PRINT N'[回填] 采购入库行 ← 采购订单行 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE p SET p.现存量 = x.v
FROM bl_purchase_in p
JOIN bd_purchase_in h ON h.单据编号 = p.单据编号 AND ISNULL(h.asp_cancel, 'N') <> 'Y'
CROSS APPLY (SELECT TOP 1 s.现存量 AS v FROM sl_recv_detail s
              WHERE s.单据编号 = h.来源单号
                AND LTRIM(RTRIM(s.采购订单行号)) = LTRIM(RTRIM(p.源单行号))
                AND LTRIM(RTRIM(s.物料编码)) = LTRIM(RTRIM(p.存货编码))
                AND ISNULL(s.asp_cancel, 'N') <> 'Y' AND s.现存量 IS NOT NULL
              ORDER BY s.id) x
WHERE p.现存量 IS NULL AND ISNULL(p.asp_cancel, 'N') <> 'Y';
PRINT N'[回填] 采购入库行 ← 暂收行 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ══════════════════ F. 自检 ══════════════════ */
DECLARE @bad int = 0;
/* F1. 三列在,且是 decimal(18,4) */
IF COL_LENGTH(N'dbo.qc_insp_detail', N'现存量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_return_detail', N'现存量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_tc_in', N'现存量') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
                WHERE c.object_id = OBJECT_ID(N'dbo.qc_insp_detail') AND c.name = N'现存量'
                  AND ty.name = N'decimal' AND c.precision = 18 AND c.scale = 4) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
                WHERE c.object_id = OBJECT_ID(N'dbo.qc_return_detail') AND c.name = N'现存量'
                  AND ty.name = N'decimal' AND c.precision = 18 AND c.scale = 4) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
                WHERE c.object_id = OBJECT_ID(N'dbo.qc_tc_in') AND c.name = N'现存量'
                  AND ty.name = N'decimal' AND c.precision = 18 AND c.scale = 4) SET @bad = @bad + 1;

/* F2. yj_field:三个面板各恰一行,且都是 hidden=1 / visible=0 */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_INSP' AND col_name = N'现存量'
      AND label = N'现存量' AND data_type = N'小数' AND place = N'detail' AND hidden = 1 AND visible = 0) <> 1 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_RETURN' AND col_name = N'现存量'
      AND label = N'现存量' AND data_type = N'小数' AND place = N'detail' AND hidden = 1 AND visible = 0) <> 1 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_TC_IN' AND col_name = N'现存量'
      AND label = N'现存量' AND data_type = N'小数' AND place = N'header' AND hidden = 1 AND visible = 0) <> 1 SET @bad = @bad + 1;

/* F3. 链路四站都得有「现存量」这个字段行(采购订单 → 暂收 → 检验/退回/特采 → 入库) */
DECLARE @need TABLE (p varchar(30));
INSERT INTO @need VALUES (N'PU_ORDER'), (N'QC_RECV'), (N'QC_INSP'), (N'QC_RETURN'), (N'QC_TC_IN'), (N'PURCHASE_IN');
IF EXISTS (SELECT 1 FROM @need n WHERE NOT EXISTS
             (SELECT 1 FROM yj_field f WHERE f.panel_code = n.p AND f.label = N'现存量')) SET @bad = @bad + 1;

/* F4. 译名(标签全局共享,≥10 语言) */
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'现存量') < 10 SET @bad = @bad + 1;

/* F5. 列级注明(三列各有 MS_Description) */
IF (SELECT COUNT(*) FROM sys.extended_properties ep
     WHERE ep.name = N'MS_Description'
       AND ((ep.major_id = OBJECT_ID(N'dbo.qc_insp_detail')   AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_insp_detail'),   N'现存量', 'ColumnId'))
         OR (ep.major_id = OBJECT_ID(N'dbo.qc_return_detail') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_return_detail'), N'现存量', 'ColumnId'))
         OR (ep.major_id = OBJECT_ID(N'dbo.qc_tc_in')         AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_tc_in'),         N'现存量', 'ColumnId')))) <> 3
  SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'采购链「现存量」贯通自检失败(物理列/字段登记/译名/注明/链路齐全)', 16, 1);
ELSE PRINT N'采购链「现存量」贯通就绪:检验/退回/特采 三处隐藏字段 + 存量回填;'
         + N'数据口径 = 采购订单制单时的库存快照(非实时库存,实时看 kucun)';
GO
