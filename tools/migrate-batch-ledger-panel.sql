/* ============================================================================
 * 送料批次台账面板(BATCH_LEDGER)—— 方案 A:独立台账列表,台账只读
 * ----------------------------------------------------------------------------
 * 背景(用户口径 2026-09-21):采购订单明细区再加一张「送料批次」明细表太冗余,
 *   改用方案 A —— 批次台账做成**独立面板**,采购订单页面保持原样。
 *
 * 内容:
 *   ① 视图 v_batch_ledger:一行 = 一个批次的**一条来源行**(批次号 × 采购订单行),
 *      取自批次台账 yj_doc_batch + 占用明细 form_flow_link + 采购订单行 bl_pu_order;
 *      含 批次号/采购订单号/行号/物料/订单数量/本批送料数量/批次数量/状态/去向单据/去向单号/
 *      送料时间/释放时间/制单人/备注。
 *      · 状态由视图直接翻成中文(ACTIVE→有效 / RELEASED→已释放;ADR-0001 数据键中文);
 *      · 去向单据按目标面板翻中文(送料暂收单/采购入库单…),兼容「一键入库」跳过暂收的批次;
 *      · 释放批次同样列出(台账/审计语义:批次号回收后留痕可查)。
 *   ② 面板元数据 yj_panel(mode=archive,只读列表;采购管理菜单 台账 组)
 *   ③ 字段 yj_field 17 行(**editable=0 → 全字段只读**,视图不可写,避免误编辑)
 *   ④ 译名 yj_translation:面板名 ×10 语言 + 新字段标签 ×10 语言
 *   ⑤ 视图与关键列的 MS_Description 中文注明(AGENTS.md 注明规范)
 *
 * 只读机制:字段 editable=0 → PanelConfigService 输出 readonly=true,表格单元格不进入编辑态;
 *   本面板不含任何写路径(视图为多表 JOIN,SQL Server 本身不可更新)。
 * 幂等:视图 CREATE OR ALTER;元数据 IF NOT EXISTS;译名 IF NOT EXISTS。可重复执行。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 视图:批次台账(一行 = 批次 × 来源行) ----------
 * 平表面板的硬性要求(QueryService.queryFlat):
 *   · 必须有 `id`(列表 `SELECT t.id AS __id ... ORDER BY t.id DESC` 用它做键与倒序)
 *   · 必须有 `asp_cancel`(列表固定 `WHERE ISNULL(t.asp_cancel,'N')<>'Y'`)
 * 故: id = 按送料时间升序的行号(倒序取 = 最新批次在最上);asp_cancel = 常量 'N'(台账无作废语义)
 * ⚠ 占用明细的 JOIN 键必须带 **target_form_no**:批次号在作废后会回收复用(唯一索引只约束 ACTIVE),
 *   同一个 batch_no 会对应多张历史下游单 —— 只按 batch_no 关联会把历史批次的行并进来(行数翻倍)。 */
IF OBJECT_ID('dbo.v_batch_ledger', 'V') IS NULL
  EXEC('CREATE VIEW dbo.v_batch_ledger AS SELECT 1 AS id');
GO
ALTER VIEW dbo.v_batch_ledger AS
SELECT
    ROW_NUMBER() OVER (ORDER BY b.create_time ASC, b.id ASC, bl.[行号] ASC) AS id,
    CAST('N' AS char(1))                  AS asp_cancel,
    b.id                                  AS [台账id],
    b.batch_no                            AS [批次号],
    b.batch_seq                           AS [批次序号],
    b.source_form_no                      AS [采购订单号],
    bl.[行号]                             AS [行号],
    bl.[物料编码]                         AS [物料编码],
    bl.[物料名称]                         AS [物料名称],
    bl.[规格型号]                         AS [规格型号],
    ISNULL(bl.[计量单位2], bl.[单位])     AS [计量单位],
    bl.[数量]                             AS [订单数量],
    l.linked_quantity                     AS [本批送料数量],
    b.batch_qty                           AS [批次数量],
    CASE b.status WHEN 'ACTIVE' THEN N'有效' ELSE N'已释放' END AS [状态],
    CASE b.target_panel_code
         WHEN 'QC_RECV'     THEN N'送料暂收单'
         WHEN 'QC_INSP'     THEN N'来料检验单'
         WHEN 'PURCHASE_IN' THEN N'采购入库单'
         WHEN 'QC_RETURN'   THEN N'暂收退回单'
         ELSE ISNULL(b.target_panel_code, N'')
    END                                   AS [去向单据],
    b.target_form_no                      AS [去向单号],
    b.create_time                         AS [送料时间],
    b.release_time                        AS [释放时间],
    b.create_by                           AS [制单人],
    b.remark                              AS [备注]
FROM dbo.yj_doc_batch b
LEFT JOIN (
    /* 占用明细先按 (批次, 来源面板, 来源单, 目标单, 来源行) 聚合:**同一行重复插入**时只算一次,
       避免行数翻倍(2026-09-21 实测库内该键无重复,聚合是防未来脏数据) */
    SELECT batch_no, source_panel_code, source_form_no, target_form_no, source_line_key,
           MAX(linked_quantity) AS linked_quantity
    FROM dbo.form_flow_link
    GROUP BY batch_no, source_panel_code, source_form_no, target_form_no, source_line_key
) l
       ON l.batch_no = b.batch_no
      AND l.source_panel_code = b.source_panel_code
      AND l.source_form_no = b.source_form_no
      AND l.target_form_no = b.target_form_no
LEFT JOIN dbo.bl_pu_order bl
       ON b.source_panel_code = N'PU_ORDER'
      AND bl.id = TRY_CAST(SUBSTRING(l.source_line_key, CHARINDEX(N'#', l.source_line_key) + 1, 32) AS int);
GO

/* ---------- 视图与关键列的中文注明 ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.v_batch_ledger') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'送料批次台账:一行=一个批次的一条来源行(批次台账 yj_doc_batch × 占用明细 form_flow_link × 采购订单行 bl_pu_order),释放批次同样保留以便追溯', N'SCHEMA', N'dbo', N'VIEW', N'v_batch_ledger';
GO
DECLARE @colComments TABLE (col SYSNAME, txt NVARCHAR(400));
INSERT INTO @colComments (col, txt) VALUES
 (N'台账id',       N'批次台账行主键(yj_doc_batch.id)'),
 (N'批次号',       N'送料批次号:采购订单号 + 3 位序号;序号在批次作废后可回收复用'),
 (N'批次序号',     N'批次号内的 3 位序号'),
 (N'采购订单号',   N'批次来源采购订单(批次只从采购订单取号)'),
 (N'行号',         N'采购订单行号'),
 (N'物料编码',     N'该批次该行送出的物料编码'),
 (N'物料名称',     N'该批次该行送出的物料名称'),
 (N'规格型号',     N'物料规格型号'),
 (N'计量单位',     N'计量单位(优先取计量单位2,回退单位)'),
 (N'订单数量',     N'采购订单行数量'),
 (N'本批送料数量', N'本批次在该行的送料量(form_flow_link.linked_quantity)'),
 (N'批次数量',     N'该批次送料总量(批次级,同一批次各行相同)'),
 (N'状态',         N'批次状态(中文):有效=占用中,已释放=批次号已回收(仅留痕)'),
 (N'去向单据',     N'该批次流向下游的单据类型(送料暂收单/采购入库单等)'),
 (N'去向单号',     N'该批次生成/流入的下游单据编号'),
 (N'送料时间',     N'批次创建时间(即生单时间)'),
 (N'释放时间',     N'批次释放时间(作废/删单回收批次号时写入)'),
 (N'制单人',       N'生成该批次的用户'),
 (N'备注',         N'批次备注');
DECLARE @c SYSNAME, @t NVARCHAR(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, txt FROM @colComments;
OPEN cur;
FETCH NEXT FROM cur INTO @c, @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.v_batch_ledger') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.v_batch_ledger'), @c, 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @t, N'SCHEMA', N'dbo', N'VIEW', N'v_batch_ledger', N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @c, @t;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------- ② 面板注册(报表式只读列表;菜单:采购管理 / 台账) ----------
 * mode=flat:通行只读列表(与 库存状况表 STOCK_BALANCE 同款),后端不下发任何编辑按钮;
 * 字段再全部 editable=0,双保险。
 * category=**报表**:前端 reportMode 的唯一开关(metadata.panelCategory==='报表'),
 *   缺了它 flat 面板会落进「单据卡片」分支而 dataSchema 为空 → 空白页(实测踩点)。 */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'BATCH_LEDGER')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, config, config_at, module_group, panel_name_en)
  VALUES ('BATCH_LEDGER', N'送料批次台账', N'报表', N'flat', N'v_batch_ledger', NULL, NULL, N'id', NULL, NULL, NULL, 50, NULL, NULL, NULL, N'采购管理', N'Batch Delivery Ledger');
UPDATE yj_panel
   SET panel_name = N'送料批次台账', category = N'报表', mode = N'flat', line_table = N'v_batch_ledger',
       head_table = NULL, group_col = NULL, pk_col = N'id', code_col = NULL, prefix = NULL, date_col = NULL,
       page_size = 50, detail_key = NULL, module_group = N'采购管理', panel_name_en = N'Batch Delivery Ledger'
 WHERE panel_code = 'BATCH_LEDGER';
GO

/* ---------- ③ 字段(**editable=0:只读**) ---------- */
DECLARE @f TABLE (col NVARCHAR(100), type NVARCHAR(20), place NVARCHAR(50), seq INT, width INT, dict NVARCHAR(500));
INSERT INTO @f (col, type, place, seq, width, dict) VALUES
 (N'批次号',       N'文本',   N'query,detail',  10, 190, NULL),
 (N'采购订单号',   N'文本',   N'query,detail',  20, 150, NULL),
 (N'行号',         N'整数',   N'detail',        30,  60, NULL),
 (N'物料编码',     N'文本',   N'query,detail',  40, 130, NULL),
 (N'物料名称',     N'文本',   N'query,detail',  50, 180, NULL),
 (N'规格型号',     N'文本',   N'detail',        60, 150, NULL),
 (N'计量单位',     N'文本',   N'detail',        70,  80, NULL),
 (N'订单数量',     N'小数',   N'detail',        80,  90, NULL),
 (N'本批送料数量', N'小数',   N'detail',        90, 110, NULL),
 (N'批次数量',     N'小数',   N'detail',       100,  90, NULL),
 (N'状态',         N'下拉框', N'query,detail', 110,  90, N'SELECT v FROM (VALUES (N''有效''),(N''已释放'')) AS t(v)'),
 (N'去向单据',     N'文本',   N'detail',       120, 110, NULL),
 (N'去向单号',     N'文本',   N'query,detail', 130, 150, NULL),
 (N'送料时间',     N'日期',   N'query,detail', 140, 150, NULL),
 (N'释放时间',     N'日期',   N'detail',       150, 150, NULL),
 (N'制单人',       N'文本',   N'detail',       160,  90, NULL),
 (N'备注',         N'文本',   N'detail',       170, 200, NULL);
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'BATCH_LEDGER', f.col, f.col, f.type, f.dict, NULL, NULL, NULL, f.place, f.seq, f.width, 0, 0, 0, 1
FROM @f f
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = 'BATCH_LEDGER' AND x.col_name = f.col);
GO

/* ---------- ④ 译名(面板名 + 新字段标签 × 10 语言) ---------- */
DECLARE @tr TABLE (scope NVARCHAR(20), ref NVARCHAR(100), loc NVARCHAR(10), txt NVARCHAR(300));
INSERT INTO @tr (scope, ref, loc, txt) VALUES
 ('panel', N'送料批次台账', 'en', N'Batch Delivery Ledger'),
 ('panel', N'送料批次台账', 'ja', N'納入バッチ台帳'),
 ('panel', N'送料批次台账', 'ko', N'납품 배치 대장'),
 ('panel', N'送料批次台账', 'zh-TW', N'送料批次台帳'),
 ('panel', N'送料批次台账', 'es', N'Libro de lotes de entrega'),
 ('panel', N'送料批次台账', 'fr', N'Registre des lots de livraison'),
 ('panel', N'送料批次台账', 'de', N'Lieferchargen-Journal'),
 ('panel', N'送料批次台账', 'ru', N'Журнал партий поставки'),
 ('panel', N'送料批次台账', 'vi', N'Sổ lô giao hàng'),
 ('panel', N'送料批次台账', 'th', N'ทะเบียนล็อตส่งมอบ'),
 ('field', N'状态', 'ja', N'状態'), ('field', N'状态', 'ko', N'상태'), ('field', N'状态', 'zh-TW', N'狀態'),
 ('field', N'状态', 'es', N'Estado'), ('field', N'状态', 'fr', N'Statut'), ('field', N'状态', 'de', N'Status'),
 ('field', N'状态', 'ru', N'Статус'), ('field', N'状态', 'vi', N'Trạng thái'), ('field', N'状态', 'th', N'สถานะ'),
 ('field', N'订单数量', 'en', N'Order Qty'), ('field', N'订单数量', 'ja', N'注文数量'), ('field', N'订单数量', 'ko', N'주문 수량'),
 ('field', N'订单数量', 'zh-TW', N'訂單數量'), ('field', N'订单数量', 'es', N'Cantidad pedida'), ('field', N'订单数量', 'fr', N'Qté commandée'),
 ('field', N'订单数量', 'de', N'Bestellmenge'), ('field', N'订单数量', 'ru', N'Кол-во в заказе'), ('field', N'订单数量', 'vi', N'SL đặt hàng'),
 ('field', N'订单数量', 'th', N'จำนวนสั่งซื้อ'),
 ('field', N'本批送料数量', 'en', N'Qty Delivered (this batch)'), ('field', N'本批送料数量', 'ja', N'今回納入数量'),
 ('field', N'本批送料数量', 'ko', N'이번 납품 수량'), ('field', N'本批送料数量', 'zh-TW', N'本批送料數量'),
 ('field', N'本批送料数量', 'es', N'Cantidad entregada (lote)'), ('field', N'本批送料数量', 'fr', N'Qté livrée (lot)'),
 ('field', N'本批送料数量', 'de', N'Gelieferte Menge (Charge)'), ('field', N'本批送料数量', 'ru', N'Кол-во поставки (партия)'),
 ('field', N'本批送料数量', 'vi', N'SL giao (lô này)'), ('field', N'本批送料数量', 'th', N'จำนวนส่ง (ล็อตนี้)'),
 ('field', N'批次数量', 'en', N'Batch Qty'), ('field', N'批次数量', 'ja', N'バッチ数量'), ('field', N'批次数量', 'ko', N'배치 수량'),
 ('field', N'批次数量', 'zh-TW', N'批次數量'), ('field', N'批次数量', 'es', N'Cantidad del lote'), ('field', N'批次数量', 'fr', N'Qté du lot'),
 ('field', N'批次数量', 'de', N'Chargenmenge'), ('field', N'批次数量', 'ru', N'Кол-во партии'), ('field', N'批次数量', 'vi', N'SL lô'),
 ('field', N'批次数量', 'th', N'จำนวนล็อต'),
 ('field', N'去向单据', 'en', N'Target Document'), ('field', N'去向单据', 'ja', N'投入先伝票'), ('field', N'去向单据', 'ko', N'대상 전표'),
 ('field', N'去向单据', 'zh-TW', N'去向單據'), ('field', N'去向单据', 'es', N'Documento destino'), ('field', N'去向单据', 'fr', N'Document cible'),
 ('field', N'去向单据', 'de', N'Zieldokument'), ('field', N'去向单据', 'ru', N'Документ назначения'), ('field', N'去向单据', 'vi', N'Chứng từ đích'),
 ('field', N'去向单据', 'th', N'เอกสารปลายทาง'),
 ('field', N'去向单号', 'en', N'Target Doc No.'), ('field', N'去向单号', 'ja', N'投入先番号'), ('field', N'去向单号', 'ko', N'대상 전표번호'),
 ('field', N'去向单号', 'zh-TW', N'去向單號'), ('field', N'去向单号', 'es', N'N.º doc. destino'), ('field', N'去向单号', 'fr', N'N° doc. cible'),
 ('field', N'去向单号', 'de', N'Zielbelegnr.'), ('field', N'去向单号', 'ru', N'Номер документа'), ('field', N'去向单号', 'vi', N'Số chứng từ đích'),
 ('field', N'去向单号', 'th', N'เลขที่เอกสารปลายทาง'),
 ('field', N'送料时间', 'en', N'Delivery Time'), ('field', N'送料时间', 'ja', N'納入日時'), ('field', N'送料时间', 'ko', N'납품 일시'),
 ('field', N'送料时间', 'zh-TW', N'送料時間'), ('field', N'送料时间', 'es', N'Fecha de entrega'), ('field', N'送料时间', 'fr', N'Date de livraison'),
 ('field', N'送料时间', 'de', N'Lieferzeitpunkt'), ('field', N'送料时间', 'ru', N'Время поставки'), ('field', N'送料时间', 'vi', N'Thời gian giao'),
 ('field', N'送料时间', 'th', N'เวลาส่งมอบ'),
 ('field', N'释放时间', 'en', N'Release Time'), ('field', N'释放时间', 'ja', N'解放日時'), ('field', N'释放时间', 'ko', N'해제 일시'),
 ('field', N'释放时间', 'zh-TW', N'釋放時間'), ('field', N'释放时间', 'es', N'Fecha de liberación'), ('field', N'释放时间', 'fr', N'Date de libération'),
 ('field', N'释放时间', 'de', N'Freigabezeitpunkt'), ('field', N'释放时间', 'ru', N'Время освобождения'), ('field', N'释放时间', 'vi', N'Thời gian giải phóng'),
 ('field', N'释放时间', 'th', N'เวลาปล่อย'),
 ('panel', N'台账', 'en', N'Ledger'), ('panel', N'台账', 'ja', N'台帳'), ('panel', N'台账', 'ko', N'대장'),
 ('panel', N'台账', 'zh-TW', N'台帳'), ('panel', N'台账', 'es', N'Libro'), ('panel', N'台账', 'fr', N'Registre'),
 ('panel', N'台账', 'de', N'Journal'), ('panel', N'台账', 'ru', N'Журнал'), ('panel', N'台账', 'vi', N'Sổ'),
 ('panel', N'台账', 'th', N'ทะเบียน');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref, t.loc, t.txt, 'manual'
FROM @tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope = t.scope AND x.ref_key = t.ref AND x.locale = t.loc);
GO

/* ---------- ⑤ 自检 ---------- */
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code = 'BATCH_LEDGER') <> 1
  RAISERROR(N'BATCH_LEDGER 面板行缺失', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BATCH_LEDGER') <> 17
  RAISERROR(N'BATCH_LEDGER 字段数应为 17', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BATCH_LEDGER' AND editable <> 0) <> 0
  RAISERROR(N'BATCH_LEDGER 必须全字段只读(editable=0)', 16, 1);
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'panel' AND ref_key = N'送料批次台账' AND locale IN ('en','ja','ko','zh-TW','es','fr','de','ru','vi','th')) <> 10
  RAISERROR(N'面板名译名应 10 语言齐全', 16, 1);
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key IN (N'订单数量',N'本批送料数量',N'批次数量',N'去向单据',N'去向单号',N'送料时间',N'释放时间',N'状态') AND locale IN ('en','ja','ko','zh-TW','es','fr','de','ru','vi','th')) <> 80
  RAISERROR(N'新字段标签译名应 8 标签 × 10 语言 = 80 行', 16, 1);
IF OBJECT_ID('dbo.v_batch_ledger', 'V') IS NULL
  RAISERROR(N'v_batch_ledger 视图缺失', 16, 1);
-- 平表契约:必须有 id(行键+倒序) 与 asp_cancel(作废过滤),否则列表接口直接 500
IF COL_LENGTH('dbo.v_batch_ledger', 'id') IS NULL OR COL_LENGTH('dbo.v_batch_ledger', 'asp_cancel') IS NULL
  RAISERROR(N'v_batch_ledger 缺 id / asp_cancel 列(平表面板契约)', 16, 1);
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code = 'BATCH_LEDGER' AND mode = 'flat') <> 1
  RAISERROR(N'BATCH_LEDGER 必须 mode=flat(仅平表模式不产生编辑按钮)', 16, 1);
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code = 'BATCH_LEDGER' AND category = N'报表') <> 1
  RAISERROR(N'BATCH_LEDGER 必须 category=报表(前端 reportMode 开关,否则空白页)', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'BATCH_LEDGER' AND place LIKE '%query%') < 5
  RAISERROR(N'BATCH_LEDGER 查询位字段过少,关键词搜索无落点', 16, 1);
PRINT N'✅ 送料批次台账面板(BATCH_LEDGER,方案 A)已就绪';
GO
