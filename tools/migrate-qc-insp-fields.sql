-- migrate-qc-insp-fields.sql — 来料检验单 QC_INSP 按参照库「品检系」补齐字段(2026-09-21)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- 参照来源:参照库备份 HSDZ_MES_backup_2026_08_28(光缆厂现网,同款 legacy MES)
--   对应面板 = 品检明细 / 品检数据 / 扫码全检(三者共用表码 pjjl)、品质追溯_品检。
--   字段存在性由 tools/_bak-scan.cjs 字节扫描取证(4MB 串表),逐字段对照见
--   docs/方案-来料三单对照参照库字段补充.md §三·附-3。
--
-- 用户口径(2026-09-21):
--   · 「来料检验单先补充完整」→ 本脚本只动 QC_INSP(暂收单/退回单的字段另案);
--   · 「**只用批次号**」→ **不补「批号」列**(行上既有「批号」列保留原样,不新增);
--     参照库的「批号」= 供应商批号,与本项目「批次号」(分批送料链批次标识)不是一回事。
--   · 表头/表体落位:参照库品检系是**平铺面板**(无头行之分),故落位由本脚本按语义定,
--     逐条声明见下(表头 3 / 表体 7)。
--
-- 本次新增 9 字段:
--   **表头(qc_insp)3 个**:检验编号 / 执行标准 / 检验类型
--   **表体(qc_insp_detail)6 个**:报废数量 / 损耗 / 损耗率 / 条码 / 成品编号 / 生产日期
--   (原第 10 个「盘号」按用户口径 2026-09-21 删除:线缆盘具口径,银嘉不适用。
--    已执行过的库由 tools/migrate-qc-insp-drop-pannum.sql 清理;本脚本已不含该字段,新库不再生成)
--
-- 幂等:逐列判存 + 逐行 NOT EXISTS + 译名 NOT EXISTS;可重复执行。
-- 运行: sqlcmd -S 127.0.0.1,1433 -U yinjia -P '***' -d HSDZ_MES -C -b -f 65001 -i tools/migrate-qc-insp-fields.sql
--   (注意:sqlcmd -i 默认 QUOTED_IDENTIFIER OFF,本库有筛选索引/计算列依赖,故下方显式 SET)
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ══════════════ 1. 表头列(qc_insp)3 个 ══════════════
-- 检验编号:单据级检验流水号(与单据编号 IJ 分离,参照库三处检验面板均有)
IF COL_LENGTH('dbo.qc_insp', N'检验编号') IS NULL ALTER TABLE qc_insp ADD [检验编号] nvarchar(60) NULL;
-- 执行标准:检验依据文本(检验方案参照 QC_PLAN 已含检验方式/抽检比例,标准是方案缺失时的兜底依据)
IF COL_LENGTH('dbo.qc_insp', N'执行标准') IS NULL ALTER TABLE qc_insp ADD [执行标准] nvarchar(200) NULL;
-- 检验类型:全检/抽检/免检(与「检验方案→检验方式」语义重叠,如不需要删该字段行即可)
IF COL_LENGTH('dbo.qc_insp', N'检验类型') IS NULL ALTER TABLE qc_insp ADD [检验类型] nvarchar(50) NULL;
GO

-- ══════════════ 2. 表体列(qc_insp_detail)7 个 ══════════════
-- 报废数量:不合格里「报废」与「退供应商」要分账(参照库与不良数量并列)
IF COL_LENGTH('dbo.qc_insp_detail', N'报废数量') IS NULL ALTER TABLE qc_insp_detail ADD [报废数量] decimal(18,4) NULL;
-- 损耗 / 损耗率:检验过程的物料损耗(参照库品检明细/品检数据均有)
IF COL_LENGTH('dbo.qc_insp_detail', N'损耗') IS NULL ALTER TABLE qc_insp_detail ADD [损耗] decimal(18,4) NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'损耗率') IS NULL ALTER TABLE qc_insp_detail ADD [损耗率] decimal(18,4) NULL;
-- 条码:扫码全检的载体,接材料二维码打印/扫码(参照库扫码全检面板主键级字段)
IF COL_LENGTH('dbo.qc_insp_detail', N'条码') IS NULL ALTER TABLE qc_insp_detail ADD [条码] nvarchar(100) NULL;
-- 成品编号 / 生产日期:件级追溯信息(参照库扫码全检/品检数据)
IF COL_LENGTH('dbo.qc_insp_detail', N'成品编号') IS NULL ALTER TABLE qc_insp_detail ADD [成品编号] nvarchar(60) NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'生产日期') IS NULL ALTER TABLE qc_insp_detail ADD [生产日期] nvarchar(20) NULL;
GO

-- ══════════════ 3. 新列中文注明(AGENTS.md 强制) ══════════════
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp'),'检验编号','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'检验编号(单据级检验流水号,与单据编号 IJ 分离;参照库品检系同名字段)', N'SCHEMA',N'dbo',N'TABLE',N'qc_insp',N'COLUMN',N'检验编号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp'),'执行标准','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'执行标准(检验依据文本;检验方案 QC_PLAN 缺失时的兜底)', N'SCHEMA',N'dbo',N'TABLE',N'qc_insp',N'COLUMN',N'执行标准';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp'),'检验类型','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'检验类型(全检/抽检/免检;与检验方案的检验方式语义重叠,可留空)', N'SCHEMA',N'dbo',N'TABLE',N'qc_insp',N'COLUMN',N'检验类型';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'),'报废数量','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'报废数量(不合格中作报废处理的部分,与退供应商分开记账)', N'SCHEMA',N'dbo',N'TABLE',N'qc_insp_detail',N'COLUMN',N'报废数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'),'损耗','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'损耗(检验过程损耗数量)', N'SCHEMA',N'dbo',N'TABLE',N'qc_insp_detail',N'COLUMN',N'损耗';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'),'损耗率','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'损耗率(损耗/送检数量,按 0~1 小数存)', N'SCHEMA',N'dbo',N'TABLE',N'qc_insp_detail',N'COLUMN',N'损耗率';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'),'条码','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'条码(材料二维码/供应商标签条码,扫码全检的载体)', N'SCHEMA',N'dbo',N'TABLE',N'qc_insp_detail',N'COLUMN',N'条码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'),'成品编号','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'成品编号(件级成品/半成品编号,供扫码追溯)', N'SCHEMA',N'dbo',N'TABLE',N'qc_insp_detail',N'COLUMN',N'成品编号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'),'生产日期','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产日期(供应商生产/制造日期)', N'SCHEMA',N'dbo',N'TABLE',N'qc_insp_detail',N'COLUMN',N'生产日期';
GO

-- ══════════════ 4. yj_field 字段注册(表头 3 + 表体 7) ══════════════
-- 栏目口径同既有 QC_INSP 行:place=query,header|header|detail|query,detail;seq 插在现有序列空档。
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'检验编号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'检验编号', N'检验编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 65, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'执行标准')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'执行标准', N'执行标准', N'文本', NULL, NULL, NULL, NULL, N'query,header', 75, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'检验类型')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'检验类型', N'检验类型', N'下拉框', N'SELECT v FROM (VALUES (N''全检''),(N''抽检''),(N''免检'')) AS t(v)', NULL, NULL, NULL, N'header', 76, 100, 1, 0, 0, 1);
-- 表体 7:接在「不合格数量(260)/处置方式(270)」之后、「批号(280)」之前
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'报废数量' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'报废数量', N'报废数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 265, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'损耗' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'损耗', N'损耗', N'小数', NULL, NULL, NULL, NULL, N'detail', 266, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'损耗率' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'损耗率', N'损耗率', N'小数', NULL, NULL, NULL, NULL, N'detail', 267, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'条码' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'条码', N'条码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 275, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'成品编号' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'成品编号', N'成品编号', N'文本', NULL, NULL, NULL, NULL, N'detail', 276, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'生产日期' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'生产日期', N'生产日期', N'日期', NULL, NULL, NULL, NULL, N'detail', 277, 120, 1, 0, 0, 1);
GO

-- ══════════════ 5. 译名(AGENTS.md 强制:新增字段必须带多语言;至少 en,本次补满 10 语言) ══════════════
-- 已存在的不覆盖(检验类型/生产日期 已有 en),缺哪个补哪个。
IF OBJECT_ID('tempdb..#qc_tr') IS NOT NULL DROP TABLE #qc_tr;
CREATE TABLE #qc_tr (label nvarchar(50), locale varchar(10), txt nvarchar(200));
INSERT INTO #qc_tr (label, locale, txt) VALUES
 (N'检验编号','en',N'Inspection No.'),      (N'检验编号','ja',N'検査番号'),        (N'检验编号','ko',N'검사 번호'),
 (N'检验编号','de',N'Prüfnummer'),          (N'检验编号','fr',N'N° d''inspection'), (N'检验编号','es',N'N.º de inspección'),
 (N'检验编号','ru',N'Номер проверки'),      (N'检验编号','th',N'หมายเลขการตรวจสอบ'), (N'检验编号','vi',N'Số kiểm tra'),
 (N'检验编号','zh-TW',N'檢驗編號'),
 (N'执行标准','en',N'Execution Standard'),  (N'执行标准','ja',N'実施基準'),        (N'执行标准','ko',N'시행 기준'),
 (N'执行标准','de',N'Ausführungsstandard'), (N'执行标准','fr',N'Norme d''exécution'), (N'执行标准','es',N'Estándar de ejecución'),
 (N'执行标准','ru',N'Стандарт исполнения'), (N'执行标准','th',N'มาตรฐานการดำเนินการ'), (N'执行标准','vi',N'Tiêu chuẩn thực hiện'),
 (N'执行标准','zh-TW',N'執行標準'),
 (N'检验类型','ja',N'検査タイプ'),          (N'检验类型','ko',N'검사 유형'),        (N'检验类型','de',N'Prüfart'),
 (N'检验类型','fr',N'Type d''inspection'),  (N'检验类型','es',N'Tipo de inspección'), (N'检验类型','ru',N'Тип проверки'),
 (N'检验类型','th',N'ประเภทการตรวจสอบ'),    (N'检验类型','vi',N'Loại kiểm tra'),    (N'检验类型','zh-TW',N'檢驗類型'),
 (N'报废数量','en',N'Scrap Quantity'),      (N'报废数量','ja',N'廃棄数量'),        (N'报废数量','ko',N'폐기 수량'),
 (N'报废数量','de',N'Ausschussmenge'),      (N'报废数量','fr',N'Quantité de rebut'), (N'报废数量','es',N'Cantidad de desecho'),
 (N'报废数量','ru',N'Количество брака'),    (N'报废数量','th',N'จำนวนของเสีย'),     (N'报废数量','vi',N'Số lượng phế phẩm'),
 (N'报废数量','zh-TW',N'報廢數量'),
 (N'损耗','en',N'Loss'),                    (N'损耗','ja',N'損耗'),               (N'损耗','ko',N'손모'),
 (N'损耗','de',N'Verlust'),                 (N'损耗','fr',N'Perte'),              (N'损耗','es',N'Pérdida'),
 (N'损耗','ru',N'Потери'),                  (N'损耗','th',N'การสูญเสีย'),          (N'损耗','vi',N'Hao hụt'),
 (N'损耗','zh-TW',N'損耗'),
 (N'损耗率','en',N'Loss Rate'),             (N'损耗率','ja',N'損耗率'),            (N'损耗率','ko',N'손모율'),
 (N'损耗率','de',N'Verlustquote'),          (N'损耗率','fr',N'Taux de perte'),     (N'损耗率','es',N'Tasa de pérdida'),
 (N'损耗率','ru',N'Коэффициент потерь'),    (N'损耗率','th',N'อัตราการสูญเสีย'),    (N'损耗率','vi',N'Tỷ lệ hao hụt'),
 (N'损耗率','zh-TW',N'損耗率'),
 (N'条码','en',N'Barcode'),                 (N'条码','ja',N'バーコード'),          (N'条码','ko',N'바코드'),
 (N'条码','de',N'Barcode'),                 (N'条码','fr',N'Code-barres'),        (N'条码','es',N'Código de barras'),
 (N'条码','ru',N'Штрих-код'),               (N'条码','th',N'บาร์โค้ด'),            (N'条码','vi',N'Mã vạch'),
 (N'条码','zh-TW',N'條碼'),
 (N'成品编号','en',N'Finished Product No.'),(N'成品编号','ja',N'完成品番号'),      (N'成品编号','ko',N'완제품 번호'),
 (N'成品编号','de',N'Fertigproduktnummer'), (N'成品编号','fr',N'N° de produit fini'), (N'成品编号','es',N'N.º de producto terminado'),
 (N'成品编号','ru',N'Номер готовой продукции'), (N'成品编号','th',N'หมายเลขผลิตภัณฑ์สำเร็จรูป'), (N'成品编号','vi',N'Số thành phẩm'),
 (N'成品编号','zh-TW',N'成品編號'),
 (N'生产日期','ja',N'製造日'),              (N'生产日期','ko',N'생산일'),          (N'生产日期','de',N'Produktionsdatum'),
 (N'生产日期','fr',N'Date de production'),  (N'生产日期','es',N'Fecha de producción'), (N'生产日期','ru',N'Дата производства'),
 (N'生产日期','th',N'วันที่ผลิต'),           (N'生产日期','vi',N'Ngày sản xuất'),    (N'生产日期','zh-TW',N'生產日期');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', t.label, t.locale, t.txt, 'manual' FROM #qc_tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                  WHERE x.scope='field' AND x.ref_key=t.label AND x.locale=t.locale);
GO

-- ══════════════ 6. 自检 ══════════════
DECLARE @fields int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_INSP'
    AND col_name IN (N'检验编号',N'执行标准',N'检验类型',N'报废数量',N'损耗',N'损耗率',N'条码',N'成品编号',N'生产日期'));
DECLARE @heads int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_INSP' AND place LIKE '%header%' AND col_name IN (N'检验编号',N'执行标准',N'检验类型'));
DECLARE @lines int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_INSP' AND place LIKE '%detail%' AND col_name IN (N'报废数量',N'损耗',N'损耗率',N'条码',N'成品编号',N'生产日期'));
-- 译名按去重后的组数判(yj_translation 历史有重复行)
DECLARE @tr int = (SELECT COUNT(*) FROM (
    SELECT DISTINCT ref_key, locale FROM yj_translation WHERE scope='field'
      AND ref_key IN (N'检验编号',N'执行标准',N'检验类型',N'报废数量',N'损耗',N'损耗率',N'条码',N'成品编号',N'生产日期')
      AND locale IN ('en','ja','ko','de','fr','es','ru','th','vi','zh-TW')) d);
IF @fields <> 9 OR @heads <> 3 OR @lines <> 6
    RAISERROR(N'[qc-insp-fields] 自检失败:字段行 %d(应 9;头 %d 应 3 / 体 %d 应 6)', 16, 1, @fields, @heads, @lines);
IF @tr <> 90
    RAISERROR(N'[qc-insp-fields] 自检失败:译名 %d 组(应 90 = 9 字段 × 10 语言)', 16, 1, @tr);
IF @fields = 9 AND @heads = 3 AND @lines = 6 AND @tr = 90
    PRINT N'[qc-insp-fields] 自检通过:表头 3 + 表体 6 字段行,译名 9×10=90 组(批号列未新增,盘号已按用户口径移除)';
GO
