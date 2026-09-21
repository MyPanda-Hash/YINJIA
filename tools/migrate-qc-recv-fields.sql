-- migrate-qc-recv-fields.sql — 送料暂收单 QC_RECV 按参照库「入库族(inh)」补齐字段(2026-09-21)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- 参照来源:参照库备份 HSDZ_MES_backup_2026_08_28(光缆厂现网,同款 legacy MES)的
--   「来料入库单」(表码 inh —— 该码是**通用入库宽表**,44 个面板共用,来料入库单只是其一)。
--   逐字段对照见 docs/方案-来料三单对照参照库字段补充.md §三·附-1 / 附-2。
--
-- 用户口径(2026-09-21):「接着补齐」= 与来料检验单同批口径
--   · **只用批次号** → 不新增「批号」列(行上「批次号」保持唯一批次标识);
--   · 表头/表体落位逐条声明(参照库是平铺面板,无头行之分);
--   · 参照库的「仓库代码+仓库名称」两头两行都有,本项目按house style收成**头一个「仓库」参照**。
--
-- 本次新增 16 个字段:
--   **表头(sl_recv)7 个**:来料性质 / 仓库 / 金额 / 税额 / 总金额 / 审核人* / 审核时间*
--     (* 列已存在,本次只补 yj_field 字段行 —— 检验单/退回单都有,独暂收单缺)
--   **表体(sl_recv_detail)9 个**:发货数量 / 剩余数量 / 退料数量 / 报废数量 / 条码 / 制单号 /
--     折扣金额 / 品质复核人 / 品质复核时间
--
-- 幂等:逐列判存 + 逐行 NOT EXISTS + 译名 NOT EXISTS;可重复执行。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ══════════════ 1. 表头列(sl_recv)5 个新增(+2 个仅登记字段行) ══════════════
-- 来料性质:免检/检验、来料/退料 的分流依据(与 bs_inv.是否检验 呼应);参照库无取值字典证据,先按文本
IF COL_LENGTH('dbo.sl_recv', N'来料性质') IS NULL ALTER TABLE sl_recv ADD [来料性质] nvarchar(50) NULL;
-- 仓库:暂收入库目标仓(参照 WH,库内存仓库名称,同 FINISH_IN/OTHER_IN/MATERIAL_OUT 口径)
IF COL_LENGTH('dbo.sl_recv', N'仓库') IS NULL ALTER TABLE sl_recv ADD [仓库] nvarchar(100) NULL;
-- 金额/税额/总金额:头汇总(与既有头「数量」同口径;行上各列仍是明细细账)
IF COL_LENGTH('dbo.sl_recv', N'金额') IS NULL ALTER TABLE sl_recv ADD [金额] decimal(18,4) NULL;
IF COL_LENGTH('dbo.sl_recv', N'税额') IS NULL ALTER TABLE sl_recv ADD [税额] decimal(18,4) NULL;
IF COL_LENGTH('dbo.sl_recv', N'总金额') IS NULL ALTER TABLE sl_recv ADD [总金额] decimal(18,4) NULL;
GO

-- ══════════════ 2. 表体列(sl_recv_detail)9 个 ══════════════
-- 发货数量:供应商发货量,与暂收量/入库量三方比对
IF COL_LENGTH('dbo.sl_recv_detail', N'发货数量') IS NULL ALTER TABLE sl_recv_detail ADD [发货数量] decimal(18,4) NULL;
-- 剩余数量:本行暂收后尚可入库/退回的余量(参照库存储式字段;与分批送料的「计算式剩余量」不是一回事)
IF COL_LENGTH('dbo.sl_recv_detail', N'剩余数量') IS NULL ALTER TABLE sl_recv_detail ADD [剩余数量] decimal(18,4) NULL;
-- 退料数量:与暂收退回单互证(参照库就是在入库行上表达退回)
IF COL_LENGTH('dbo.sl_recv_detail', N'退料数量') IS NULL ALTER TABLE sl_recv_detail ADD [退料数量] decimal(18,4) NULL;
-- 报废数量:不合格中作报废的部分
IF COL_LENGTH('dbo.sl_recv_detail', N'报废数量') IS NULL ALTER TABLE sl_recv_detail ADD [报废数量] decimal(18,4) NULL;
-- 条码:材料二维码/供应商标签条码,接扫码收货与批号追溯
IF COL_LENGTH('dbo.sl_recv_detail', N'条码') IS NULL ALTER TABLE sl_recv_detail ADD [条码] nvarchar(100) NULL;
-- 制单号:制单来源编号留痕(参照库同名字段)
IF COL_LENGTH('dbo.sl_recv_detail', N'制单号') IS NULL ALTER TABLE sl_recv_detail ADD [制单号] nvarchar(60) NULL;
-- 折扣金额:折扣率与实际折让金额分列(参照库并列)
IF COL_LENGTH('dbo.sl_recv_detail', N'折扣金额') IS NULL ALTER TABLE sl_recv_detail ADD [折扣金额] decimal(18,4) NULL;
-- 品质复核人/品质复核时间:品质复核留痕(legacy 重建 DDL 曾有此二列,现库未落)
IF COL_LENGTH('dbo.sl_recv_detail', N'品质复核人') IS NULL ALTER TABLE sl_recv_detail ADD [品质复核人] nvarchar(50) NULL;
IF COL_LENGTH('dbo.sl_recv_detail', N'品质复核时间') IS NULL ALTER TABLE sl_recv_detail ADD [品质复核时间] nvarchar(30) NULL;
GO

-- ══════════════ 3. 新列中文注明(AGENTS.md 强制) ══════════════
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv'),'来料性质','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'来料性质(免检/检验、来料/退料的分流依据;参照库品检系字段)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv',N'COLUMN',N'来料性质';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv'),'仓库','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓库(暂收目标仓,参照仓库档案 WH,存仓库名称)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv',N'COLUMN',N'仓库';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv'),'金额','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金额(头汇总,未税金额合计)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv',N'COLUMN',N'金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv'),'税额','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'税额(头汇总)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv',N'COLUMN',N'税额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv'),'总金额','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'总金额(头汇总,含税金额合计)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv',N'COLUMN',N'总金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'),'发货数量','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'发货数量(供应商实际发货量,与暂收量/入库量比对)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv_detail',N'COLUMN',N'发货数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'),'剩余数量','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'剩余数量(本行暂收后可入库/退回的余量;参照库存储式字段)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv_detail',N'COLUMN',N'剩余数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'),'退料数量','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'退料数量(与暂收退回单互证)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv_detail',N'COLUMN',N'退料数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'),'报废数量','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'报废数量(不合格中作报废处理的部分)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv_detail',N'COLUMN',N'报废数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'),'条码','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'条码(材料二维码/供应商标签条码,扫码收货与批号追溯用)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv_detail',N'COLUMN',N'条码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'),'制单号','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'制单号(制单来源编号留痕;参照库同名字段,语义待业务确认)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv_detail',N'COLUMN',N'制单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'),'折扣金额','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'折扣金额(折让金额;与折扣率列分列)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv_detail',N'COLUMN',N'折扣金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'),'品质复核人','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'品质复核人(参照职员档案 EMP)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv_detail',N'COLUMN',N'品质复核人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.sl_recv_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.sl_recv_detail'),'品质复核时间','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'品质复核时间(参照库同族字段另有「品质审核时间」)', N'SCHEMA',N'dbo',N'TABLE',N'sl_recv_detail',N'COLUMN',N'品质复核时间';
GO

-- ══════════════ 4. yj_field 字段注册(表头 7 + 表体 9) ══════════════
-- 表头:来料性质 55 / 仓库 60 接在「供应商(50)」后;金额 41-43 接在「数量(40)」后;审核人 300 / 审核时间 310 收尾
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'来料性质' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'来料性质', N'来料性质', N'文本', NULL, NULL, NULL, NULL, N'query,header', 55, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'仓库' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'仓库', N'仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'query,header', 60, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'金额' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'header', 41, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'税额' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'税额', N'税额', N'小数', NULL, NULL, NULL, NULL, N'header', 42, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'总金额' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'总金额', N'总金额', N'小数', NULL, NULL, NULL, NULL, N'header', 43, 100, 1, 0, 0, 1);
-- 审核人/审核时间:列已在(sl_recv),本次只补字段行(检验单/退回单早有此二行)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'审核人' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'审核人', N'审核人', N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'header', 300, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'审核时间' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 310, 140, 0, 0, 0, 1);
-- 表体:条码 55(件级追溯) / 发货·剩余·退料·报废 65-68(数量组) / 折扣金额 105(接折扣) / 制单号·品质复核 280-295(留痕组)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'条码' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'条码', N'条码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 55, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'发货数量' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'发货数量', N'发货数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 65, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'剩余数量' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'剩余数量', N'剩余数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 66, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'退料数量' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'退料数量', N'退料数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 67, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'报废数量' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'报废数量', N'报废数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 68, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'折扣金额' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'折扣金额', N'折扣金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 105, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'制单号' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'制单号', N'制单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 280, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'品质复核人' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'品质复核人', N'品质复核人', N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'detail', 290, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'品质复核时间' AND place LIKE '%detail%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_RECV', N'品质复核时间', N'品质复核时间', N'文本', NULL, NULL, NULL, NULL, N'detail', 295, 140, 1, 0, 0, 1);
GO

-- ══════════════ 5. 译名(10 语言;已存在的不覆盖) ══════════════
IF OBJECT_ID('tempdb..#rcv_tr') IS NOT NULL DROP TABLE #rcv_tr;
CREATE TABLE #rcv_tr (label nvarchar(50), locale varchar(10), txt nvarchar(200));
INSERT INTO #rcv_tr (label, locale, txt) VALUES
 (N'来料性质','en',N'Incoming Material Type'),(N'来料性质','ja',N'受入材質'),(N'来料性质','ko',N'입고 자재 유형'),
 (N'来料性质','de',N'Art des Eingangsmaterials'),(N'来料性质','fr',N'Type de matériau entrant'),(N'来料性质','es',N'Tipo de material entrante'),
 (N'来料性质','ru',N'Тип поступающего материала'),(N'来料性质','th',N'ประเภทวัสดุรับเข้า'),(N'来料性质','vi',N'Loại vật tư nhập'),
 (N'来料性质','zh-TW',N'來料性質'),
 (N'仓库','zh-TW',N'倉庫'),
 (N'金额','ja',N'金額'),(N'金额','ko',N'금액'),(N'金额','de',N'Betrag'),(N'金额','fr',N'Montant'),
 (N'金额','es',N'Importe'),(N'金额','ru',N'Сумма'),(N'金额','th',N'จำนวนเงิน'),(N'金额','vi',N'Số tiền'),(N'金额','zh-TW',N'金額'),
 (N'税额','zh-TW',N'稅額'),(N'总金额','zh-TW',N'總金額'),
 (N'审核人','zh-TW',N'審核人'),(N'审核时间','zh-TW',N'審核時間'),
 (N'折扣金额','zh-TW',N'折扣金額'),
 (N'发货数量','en',N'Shipped Quantity'),(N'发货数量','ja',N'出荷数量'),(N'发货数量','ko',N'출하 수량'),
 (N'发货数量','de',N'Versandmenge'),(N'发货数量','fr',N'Quantité expédiée'),(N'发货数量','es',N'Cantidad enviada'),
 (N'发货数量','ru',N'Отгруженное количество'),(N'发货数量','th',N'จำนวนที่จัดส่ง'),(N'发货数量','vi',N'Số lượng giao'),
 (N'发货数量','zh-TW',N'發貨數量'),
 (N'剩余数量','en',N'Remaining Quantity'),(N'剩余数量','ja',N'残数量'),(N'剩余数量','ko',N'잔여 수량'),
 (N'剩余数量','de',N'Restmenge'),(N'剩余数量','fr',N'Quantité restante'),(N'剩余数量','es',N'Cantidad restante'),
 (N'剩余数量','ru',N'Остаток'),(N'剩余数量','th',N'จำนวนคงเหลือ'),(N'剩余数量','vi',N'Số lượng còn lại'),
 (N'剩余数量','zh-TW',N'剩餘數量'),
 (N'退料数量','en',N'Returned Material Quantity'),(N'退料数量','ja',N'返却数量'),(N'退料数量','ko',N'반납 수량'),
 (N'退料数量','de',N'Rückgabemenge'),(N'退料数量','fr',N'Quantité retournée'),(N'退料数量','es',N'Cantidad devuelta'),
 (N'退料数量','ru',N'Количество возврата'),(N'退料数量','th',N'จำนวนคืนวัสดุ'),(N'退料数量','vi',N'Số lượng trả lại'),
 (N'退料数量','zh-TW',N'退料數量'),
 (N'制单号','en',N'Prepared Doc No.'),(N'制单号','ja',N'作成元番号'),(N'制单号','ko',N'작성 번호'),
 (N'制单号','de',N'Erstellte Belegnummer'),(N'制单号','fr',N'N° du document créé'),(N'制单号','es',N'N.º de documento creado'),
 (N'制单号','ru',N'Номер созданного документа'),(N'制单号','th',N'หมายเลขเอกสารที่สร้าง'),(N'制单号','vi',N'Số chứng từ tạo'),
 (N'制单号','zh-TW',N'製單號'),
 (N'品质复核人','en',N'Quality Reviewer'),(N'品质复核人','ja',N'品質復核者'),(N'品质复核人','ko',N'품질 검토자'),
 (N'品质复核人','de',N'Qualitätsprüfer'),(N'品质复核人','fr',N'Réviseur qualité'),(N'品质复核人','es',N'Revisor de calidad'),
 (N'品质复核人','ru',N'Проверяющий качества'),(N'品质复核人','th',N'ผู้ตรวจสอบคุณภาพ'),(N'品质复核人','vi',N'Người phúc tra chất lượng'),
 (N'品质复核人','zh-TW',N'品質複核人'),
 (N'品质复核时间','en',N'Quality Review Time'),(N'品质复核时间','ja',N'品質復核日時'),(N'品质复核时间','ko',N'품질 검토 시간'),
 (N'品质复核时间','de',N'Qualitätsprüfungszeit'),(N'品质复核时间','fr',N'Heure de révision qualité'),(N'品质复核时间','es',N'Hora de revisión de calidad'),
 (N'品质复核时间','ru',N'Время проверки качества'),(N'品质复核时间','th',N'เวลาตรวจสอบคุณภาพ'),(N'品质复核时间','vi',N'Thời gian phúc tra chất lượng'),
 (N'品质复核时间','zh-TW',N'品質複核時間');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', t.label, t.locale, t.txt, 'manual' FROM #rcv_tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                  WHERE x.scope='field' AND x.ref_key=t.label AND x.locale=t.locale);
GO

-- ══════════════ 6. 自检 ══════════════
-- 表头/表体计数必须按 place 过滤:「金额/税额/总金额」在行上本来就有同名明细行(那是明细账),
-- 不按 place 过滤会把明细行也算成表头行(实测 7 会被算成 10)。
DECLARE @h int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RECV' AND place LIKE '%header%'
    AND col_name IN (N'来料性质',N'仓库',N'金额',N'税额',N'总金额',N'审核人',N'审核时间'));
DECLARE @d int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RECV' AND place LIKE '%detail%'
    AND col_name IN (N'发货数量',N'剩余数量',N'退料数量',N'报废数量',N'条码',N'制单号',N'折扣金额',N'品质复核人',N'品质复核时间'));
-- 注:yj_translation 历史上有重复 (ref_key,locale) 行(实测 scope='field' 有 22 组重复),故按
--    **去重后的组数**判定而非行数;本脚本只补缺,不删历史重复行。
DECLARE @tr int = (SELECT COUNT(*) FROM (
    SELECT DISTINCT ref_key, locale FROM yj_translation WHERE scope='field'
      AND ref_key IN (N'来料性质',N'仓库',N'金额',N'税额',N'总金额',N'审核人',N'审核时间',N'发货数量',N'剩余数量',N'退料数量',N'制单号',N'折扣金额',N'品质复核人',N'品质复核时间')
      AND locale IN ('en','ja','ko','de','fr','es','ru','th','vi','zh-TW')) d);
IF @h <> 7 OR @d <> 9
    RAISERROR(N'[qc-recv-fields] 自检失败:表头 %d(应 7)/表体 %d(应 9)', 16, 1, @h, @d);
IF @tr <> 140
    RAISERROR(N'[qc-recv-fields] 自检失败:译名 %d 条(应 140 = 14 标签 × 10 语言)', 16, 1, @tr);
IF @h = 7 AND @d = 9 AND @tr = 140
    PRINT N'[qc-recv-fields] 自检通过:表头 7 + 表体 9 = 16 字段,译名 14×10=140 条(未新增「批号」列,沿用批次号)';
GO
