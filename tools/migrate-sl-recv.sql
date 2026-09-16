-- migrate-sl-recv.sql — 送料暂收单 SL_RECV(库存核算,2026-09-15)
-- 新单据页面:字段与暂收入库单(QC_RECV)同源(同一 legacy 口径),头部另加 附件1..6(一个附件按钮,6 名称列位;
-- 文件实体存 yj_attachment,同检验单模式)。
-- 数据来源=采购订单(PU_ORDER):选单(SELECT_FLOWS)+生单(PUSH_TARGETS)在 PanelConfigService 代码注册;
-- 修改时同步修改来料检验单(QC_INSP)在 ButtonService.syncInspFromSlRecv(经 form_flow_link 关联)。
-- 幂等:可重复执行(表不存在才建、逐列补列;yj_field 清旧插新;翻译 NOT EXISTS)。
-- 运行(UTF-8 无 BOM,需 -f 65001):
--   docker cp tools/migrate-sl-recv.sql mssql2019:/tmp/
--   docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P *** -d HSDZ_MES -C -f 65001 -i /tmp/migrate-sl-recv.sql"
SET NOCOUNT ON;

-- ══════════ 1. 表(头表含 6 附件列位;明细=暂收家族 25 业务列) ══════════
IF OBJECT_ID('sl_recv') IS NULL CREATE TABLE sl_recv (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [业务员] nvarchar(50) NULL,
  [供应商代码] nvarchar(100) NULL,
  [供应商] nvarchar(200) NULL,
  [部门] nvarchar(100) NULL,
  [部门名称] nvarchar(100) NULL,
  [数量] decimal(18,4) NULL,
  [附件1] nvarchar(500) NULL, [附件2] nvarchar(500) NULL, [附件3] nvarchar(500) NULL,
  [附件4] nvarchar(500) NULL, [附件5] nvarchar(500) NULL, [附件6] nvarchar(500) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('sl_recv') IS NOT NULL AND COL_LENGTH('dbo.sl_recv', N'附件1') IS NULL
  ALTER TABLE sl_recv ADD [附件1] nvarchar(500) NULL, [附件2] nvarchar(500) NULL, [附件3] nvarchar(500) NULL,
                          [附件4] nvarchar(500) NULL, [附件5] nvarchar(500) NULL, [附件6] nvarchar(500) NULL;
IF OBJECT_ID('sl_recv') IS NOT NULL AND COL_LENGTH('dbo.sl_recv', N'业务员') IS NULL
  ALTER TABLE sl_recv ADD [业务员] nvarchar(50) NULL, [供应商代码] nvarchar(100) NULL, [部门] nvarchar(100) NULL, [部门名称] nvarchar(100) NULL, [数量] decimal(18,4) NULL;
IF OBJECT_ID('sl_recv_detail') IS NULL CREATE TABLE sl_recv_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [物料编码] nvarchar(100) NULL,
  [物料名称] nvarchar(200) NULL,
  [型号] nvarchar(200) NULL,
  [物料描述] nvarchar(500) NULL,
  [数量] decimal(18,4) NULL,
  [日期] nvarchar(20) NULL,
  [供应商] nvarchar(200) NULL,
  [单价] decimal(18,4) NULL,
  [折扣] decimal(18,4) NULL,
  [金额] decimal(18,4) NULL,
  [备注] nvarchar(500) NULL,
  [采购单号] nvarchar(60) NULL,
  [入库数量] decimal(18,4) NULL,
  [入库单号] nvarchar(60) NULL,
  [领料单号] nvarchar(60) NULL,
  [结案] nvarchar(10) NULL,
  [税别代码] nvarchar(40) NULL,
  [税别说明] nvarchar(100) NULL,
  [税额] decimal(18,4) NULL,
  [总金额] decimal(18,4) NULL,
  [订单号] nvarchar(60) NULL,
  [箱数] decimal(18,4) NULL,
  [部门] nvarchar(100) NULL,
  [部门名称] nvarchar(100) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
-- 逐列幂等补列(每列独立判断,任意中间状态可收敛)
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'物料编码') IS NULL ALTER TABLE sl_recv_detail ADD [物料编码] nvarchar(100) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'物料名称') IS NULL ALTER TABLE sl_recv_detail ADD [物料名称] nvarchar(200) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'型号') IS NULL ALTER TABLE sl_recv_detail ADD [型号] nvarchar(200) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'物料描述') IS NULL ALTER TABLE sl_recv_detail ADD [物料描述] nvarchar(500) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'数量') IS NULL ALTER TABLE sl_recv_detail ADD [数量] decimal(18,4) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'日期') IS NULL ALTER TABLE sl_recv_detail ADD [日期] nvarchar(20) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'供应商') IS NULL ALTER TABLE sl_recv_detail ADD [供应商] nvarchar(200) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'单价') IS NULL ALTER TABLE sl_recv_detail ADD [单价] decimal(18,4) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'折扣') IS NULL ALTER TABLE sl_recv_detail ADD [折扣] decimal(18,4) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'金额') IS NULL ALTER TABLE sl_recv_detail ADD [金额] decimal(18,4) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'备注') IS NULL ALTER TABLE sl_recv_detail ADD [备注] nvarchar(500) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'采购单号') IS NULL ALTER TABLE sl_recv_detail ADD [采购单号] nvarchar(60) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'入库数量') IS NULL ALTER TABLE sl_recv_detail ADD [入库数量] decimal(18,4) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'入库单号') IS NULL ALTER TABLE sl_recv_detail ADD [入库单号] nvarchar(60) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'领料单号') IS NULL ALTER TABLE sl_recv_detail ADD [领料单号] nvarchar(60) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'结案') IS NULL ALTER TABLE sl_recv_detail ADD [结案] nvarchar(10) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'税别代码') IS NULL ALTER TABLE sl_recv_detail ADD [税别代码] nvarchar(40) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'税别说明') IS NULL ALTER TABLE sl_recv_detail ADD [税别说明] nvarchar(100) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'税额') IS NULL ALTER TABLE sl_recv_detail ADD [税额] decimal(18,4) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'总金额') IS NULL ALTER TABLE sl_recv_detail ADD [总金额] decimal(18,4) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'订单号') IS NULL ALTER TABLE sl_recv_detail ADD [订单号] nvarchar(60) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'箱数') IS NULL ALTER TABLE sl_recv_detail ADD [箱数] decimal(18,4) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'部门') IS NULL ALTER TABLE sl_recv_detail ADD [部门] nvarchar(100) NULL;
IF OBJECT_ID('sl_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'部门名称') IS NULL ALTER TABLE sl_recv_detail ADD [部门名称] nvarchar(100) NULL;
GO

-- ══════════ 2. 面板注册(库存核算;前缀 SL) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='SL_RECV')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
  VALUES ('SL_RECV', N'送料暂收单', N'库存核算', 'doc', 'sl_recv_detail', 'sl_recv', N'单据编号', N'id', N'单据编号', N'SL', N'单据日期', 20, 'items', N'库存核算', N'Temporary Material Receipt');
ELSE
  UPDATE yj_panel SET panel_name=N'送料暂收单', panel_name_en=N'Temporary Material Receipt', head_table='sl_recv', line_table='sl_recv_detail', prefix=N'SL', date_col=N'单据日期', module_group=N'库存核算' WHERE panel_code='SL_RECV';
GO

-- ══════════ 3. 字段元数据(表头 8 字段+附件1..6;明细行序对齐 legacy,与 QC_RECV 一致) ══════════
DELETE FROM yj_field WHERE panel_code='SL_RECV';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('SL_RECV', N'单据编号', N'单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1),
('SL_RECV', N'单据日期', N'日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1),
('SL_RECV', N'业务员', N'业务员', N'文本', NULL, NULL, NULL, NULL, N'query,header', 30, 100, 1, 0, 0, 1),
('SL_RECV', N'供应商代码', N'供应商代码', N'参照', NULL, N'PARTNER', N'往来单位编码', N'往来单位名称', N'query,header', 40, 130, 1, 0, 0, 1),
('SL_RECV', N'供应商', N'供应商', N'参照', NULL, N'PARTNER', N'往来单位名称', N'往来单位名称', N'query,header', 50, 180, 1, 0, 0, 1),
('SL_RECV', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'header', 60, 120, 1, 0, 0, 1),
('SL_RECV', N'部门名称', N'部门名称', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 0, 1),
('SL_RECV', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'header', 80, 100, 1, 0, 0, 1),
('SL_RECV', N'附件1', N'附件1', N'附件', NULL, NULL, NULL, NULL, N'header', 91, 220, 1, 0, 0, 1),
('SL_RECV', N'附件2', N'附件2', N'附件', NULL, NULL, NULL, NULL, N'header', 92, 220, 1, 0, 0, 1),
('SL_RECV', N'附件3', N'附件3', N'附件', NULL, NULL, NULL, NULL, N'header', 93, 220, 1, 0, 0, 1),
('SL_RECV', N'附件4', N'附件4', N'附件', NULL, NULL, NULL, NULL, N'header', 94, 220, 1, 0, 0, 1),
('SL_RECV', N'附件5', N'附件5', N'附件', NULL, NULL, NULL, NULL, N'header', 95, 220, 1, 0, 0, 1),
('SL_RECV', N'附件6', N'附件6', N'附件', NULL, NULL, NULL, NULL, N'header', 96, 220, 1, 0, 0, 1),
('SL_RECV', N'单据编号', N'单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 150, 0, 0, 0, 1),
('SL_RECV', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 200, 130, 1, 1, 0, 1),
('SL_RECV', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 160, 1, 0, 0, 1),
('SL_RECV', N'型号', N'型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 140, 1, 0, 0, 1),
('SL_RECV', N'物料描述', N'物料描述', N'文本', NULL, NULL, NULL, NULL, N'detail', 230, 200, 1, 0, 0, 1),
('SL_RECV', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 240, 100, 1, 0, 0, 1),
('SL_RECV', N'日期', N'日期', N'日期', NULL, NULL, NULL, NULL, N'detail', 250, 110, 1, 0, 0, 1),
('SL_RECV', N'供应商', N'供应商', N'参照', NULL, N'PARTNER', N'往来单位名称', N'往来单位名称', N'detail', 260, 160, 1, 0, 0, 1),
('SL_RECV', N'单价', N'单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 270, 90, 1, 0, 0, 1),
('SL_RECV', N'折扣', N'折扣', N'小数', NULL, NULL, NULL, NULL, N'detail', 280, 80, 1, 0, 0, 1),
('SL_RECV', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 290, 100, 1, 0, 0, 1),
('SL_RECV', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 300, 200, 1, 0, 0, 1),
('SL_RECV', N'采购单号', N'采购单号', N'参照', NULL, N'PU_ORDER', N'单据编号', N'单据编号', N'detail', 310, 140, 1, 0, 0, 1),
('SL_RECV', N'入库数量', N'入库数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 320, 100, 1, 0, 0, 1),
('SL_RECV', N'入库单号', N'入库单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 330, 130, 1, 0, 0, 1),
('SL_RECV', N'领料单号', N'领料单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 340, 130, 1, 0, 0, 1),
('SL_RECV', N'结案', N'结案', N'下拉框', N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)', NULL, NULL, NULL, N'detail', 350, 80, 1, 0, 0, 1),
('SL_RECV', N'税别代码', N'税别代码', N'文本', NULL, NULL, NULL, NULL, N'detail', 360, 100, 1, 0, 0, 1),
('SL_RECV', N'税别说明', N'税别说明', N'文本', NULL, NULL, NULL, NULL, N'detail', 370, 120, 1, 0, 0, 1),
('SL_RECV', N'税额', N'税额', N'小数', NULL, NULL, NULL, NULL, N'detail', 380, 90, 1, 0, 0, 1),
('SL_RECV', N'总金额', N'总金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 390, 100, 1, 0, 0, 1),
('SL_RECV', N'订单号', N'订单号', N'参照', NULL, N'SO_ORDER', N'单据编号', N'单据编号', N'detail', 400, 140, 1, 0, 0, 1),
('SL_RECV', N'箱数', N'箱数', N'小数', NULL, NULL, NULL, NULL, N'detail', 410, 80, 1, 0, 0, 1),
('SL_RECV', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'detail', 420, 100, 1, 0, 0, 1),
('SL_RECV', N'部门名称', N'部门名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 430, 100, 1, 0, 0, 1);
GO

-- ══════════ 4. 译名(面板名 en/ja;字段标签全部与来料三单共享,已有译名不重复插) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'送料暂收单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'送料暂收单', 'en', N'Temporary Material Receipt', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'送料暂收单' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'送料暂收单', 'ja', N'材料仮受伝票', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'送料暂收单' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'送料暂收单', 'ko', N'자재 임시수령서', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'送料暂收单' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'送料暂收单', 'es', N'Recepción temporal de material', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'送料暂收单' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'送料暂收单', 'fr', N'Réception temporaire de matière', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'送料暂收单' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'送料暂收单', 'de', N'Vorübergehende Materialeingang', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'送料暂收单' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'送料暂收单', 'ru', N'Временное получение материала', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'送料暂收单' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'送料暂收单', 'vi', N'Phiếu tạm nhận vật tư', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'送料暂收单' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'送料暂收单', 'th', N'ใบรับวัสดุชั่วคราว', 'manual');
GO

-- ══════════ 5. 收尾:幽灵字段自检(detail 行必须有行表列,header 行必须有头表或行表列;两项均应为 0) ══════════
SELECT p.panel_code,
       SUM(CASE WHEN f.place LIKE '%detail%' AND COL_LENGTH('dbo.' + p.line_table, f.col_name) IS NULL THEN 1 ELSE 0 END) AS missing_line_cols,
       SUM(CASE WHEN f.place LIKE '%header%' AND COL_LENGTH('dbo.' + p.head_table, f.col_name) IS NULL
                 AND COL_LENGTH('dbo.' + p.line_table, f.col_name) IS NULL THEN 1 ELSE 0 END) AS missing_head_cols
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE f.panel_code = 'SL_RECV'
GROUP BY p.panel_code;
PRINT N'migrate-sl-recv 完成:送料暂收单(表/面板/字段/译名;附件1..6;选单生单与同步修改在代码侧注册)';
GO
