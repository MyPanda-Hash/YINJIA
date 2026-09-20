-- migrate-po-chain-link.sql — 采购链「采购订单号 / 采购订单行号」贯通(2026-09-20)
-- ════════════════════════════════════════════════════════════════════════════
-- 目的:让 采购订单号(头级)+ 采购订单行号(行级)沿
--         采购订单(PU_ORDER) → 送料暂收单(SL_RECV) → 来料检验单(QC_INSP) → 采购入库单(PURCHASE_IN)
--       逐站下传,使采购入库单能带齐这两个字段,并在「转ERP」时作为金蝶源单关联
--       (src_bill_no / src_seq)推送(见 KingdeePushService)。
--
-- 口径(与 deploy/采购入库单字段接口核对.md 一致):
--   ① 采购订单行号 = 金蝶 pur_order 分录 seq;MES 侧新增 bl_pu_order.行号,由 sync-core.mjs
--      mapLines 写入(行表按单整单重写,存量单据按 id 升序回填,与金蝶 seq 同序)。
--   ② 送料暂收单 / 来料检验单 各补「头 采购订单号 + 行 采购订单行号」——链路映射靠 yj_field
--      里这两个标签存在才生效(PanelConfigService 同义词按标签查),故字段必须先注册。
--   ③ 采购入库行**不新增同义列**:沿用既有列 bl_purchase_in.源单行号(金蝶 src_seq 落点),
--      仅把标签改成「采购订单行号」并放开显示——同一语义不造双列,同步与链路共用一个落点。
--   ④ 采购入库头 采购订单号 已存在(migrate-po-inbound-fields.sql),不动。
--
-- 幂等:可重复执行(列存在即跳过;yj_field 按 panel_code+col_name 判存;注释按存在性加)。
-- ════════════════════════════════════════════════════════════════════════════
SET NOCOUNT ON;

-- ══════════ 1) 采购订单行号取值源:bl_pu_order.行号(= 金蝶分录 seq) ══════════
IF COL_LENGTH('dbo.bl_pu_order', N'行号') IS NULL
    ALTER TABLE dbo.bl_pu_order ADD [行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PU_ORDER', N'行号', N'行号', N'文本', NULL, NULL, NULL, NULL, N'detail', 5, 90, 0, 0, 0, 1);
GO
-- 存量回填(独立批次:同一批次内 ALTER 的新列在编译期不可见)
-- upsertDoc 按单 DELETE+INSERT 明细(插入顺序=金蝶明细顺序),故 id 升序≡金蝶 seq
;WITH x AS (SELECT id, 行号, ROW_NUMBER() OVER (PARTITION BY 单据编号 ORDER BY id) AS rn FROM bl_pu_order)
UPDATE x SET 行号 = rn WHERE ISNULL(x.行号, N'') = N'';
GO

-- ══════════ 2) 送料暂收单:头 采购订单号 + 行 采购订单行号 ══════════
IF COL_LENGTH('dbo.sl_recv', N'采购订单号') IS NULL
    ALTER TABLE dbo.sl_recv ADD [采购订单号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SL_RECV' AND col_name=N'采购订单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SL_RECV', N'采购订单号', N'采购订单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 200, 150, 1, 0, 0, 1);

IF COL_LENGTH('dbo.sl_recv_detail', N'采购订单行号') IS NULL
    ALTER TABLE dbo.sl_recv_detail ADD [采购订单行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SL_RECV' AND col_name=N'采购订单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SL_RECV', N'采购订单行号', N'采购订单行号', N'文本', NULL, NULL, NULL, NULL, N'detail', 205, 110, 1, 0, 0, 1);

-- ══════════ 3) 来料检验单:头 采购订单号 + 行 采购订单行号 ══════════
IF COL_LENGTH('dbo.qc_insp', N'采购订单号') IS NULL
    ALTER TABLE dbo.qc_insp ADD [采购订单号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'采购订单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_INSP', N'采购订单号', N'采购订单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 35, 150, 1, 0, 0, 1);

IF COL_LENGTH('dbo.qc_insp_detail', N'采购订单行号') IS NULL
    ALTER TABLE dbo.qc_insp_detail ADD [采购订单行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'采购订单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_INSP', N'采购订单行号', N'采购订单行号', N'文本', NULL, NULL, NULL, NULL, N'detail', 205, 110, 1, 0, 0, 1);

-- ══════════ 4) 采购入库行:源单行号 列 → 标签「采购订单行号」并放开显示 ══════════
UPDATE yj_field SET label = N'采购订单行号', hidden = 0, visible = 1, seq = 305, width = 110
WHERE panel_code = 'PURCHASE_IN' AND col_name = N'源单行号';

-- ══════════ 5) 译名(field 域;采购订单号 已有 9 语言,行号/采购订单行号 补齐) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行号' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行号', 'ja', N'行番号', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行号' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行号', 'ko', N'행 번호', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行号' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行号', 'de', N'Positionsnr.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行号' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行号', 'es', N'N.º de línea', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行号' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行号', 'fr', N'N° de ligne', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行号' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行号', 'ru', N'Номер строки', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行号' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行号', 'vi', N'Số dòng', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行号' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行号', 'th', N'เลขที่บรรทัด', 'manual');

IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购订单行号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购订单行号', 'en', N'PO Line No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购订单行号' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购订单行号', 'ja', N'調達注文行番号', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购订单行号' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购订单行号', 'ko', N'구매 주문 행 번호', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购订单行号' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购订单行号', 'de', N'Bestellpositionsnr.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购订单行号' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购订单行号', 'es', N'N.º de línea del pedido', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购订单行号' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购订单行号', 'fr', N'N° de ligne de commande', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购订单行号' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购订单行号', 'ru', N'Номер строки заказа', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购订单行号' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购订单行号', 'vi', N'Số dòng đơn mua', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购订单行号' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购订单行号', 'th', N'เลขที่บรรทัดใบสั่งซื้อ', 'manual');

-- ══════════ 6) 列中文注明(MS_Description;存在即不覆盖) ══════════
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bl_pu_order') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_pu_order'), N'行号', 'ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'采购订单行号(金蝶 pur_order 分录 seq,链路下传用)', N'SCHEMA', N'dbo', N'TABLE', N'bl_pu_order', N'COLUMN', N'行号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.sl_recv') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.sl_recv'), N'采购订单号', 'ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'来源采购订单号(链路带入,转ERP 用)', N'SCHEMA', N'dbo', N'TABLE', N'sl_recv', N'COLUMN', N'采购订单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.sl_recv_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.sl_recv_detail'), N'采购订单行号', 'ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'对应采购订单行号(链路带入)', N'SCHEMA', N'dbo', N'TABLE', N'sl_recv_detail', N'COLUMN', N'采购订单行号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.qc_insp') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_insp'), N'采购订单号', 'ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'来源采购订单号(链路带入)', N'SCHEMA', N'dbo', N'TABLE', N'qc_insp', N'COLUMN', N'采购订单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.qc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_insp_detail'), N'采购订单行号', 'ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'对应采购订单行号(链路带入)', N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_detail', N'COLUMN', N'采购订单行号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bl_purchase_in') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_purchase_in'), N'源单行号', 'ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'采购订单行号(链路带入;金蝶同步时落 src_seq;转ERP 推送为 src_seq)', N'SCHEMA', N'dbo', N'TABLE', N'bl_purchase_in', N'COLUMN', N'源单行号';
GO

-- ══════════ 自检 ══════════
SELECT N'bl_pu_order.行号' AS 项, COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(行号,N'')<>N'' THEN 1 ELSE 0 END) AS 有值 FROM bl_pu_order
UNION ALL SELECT N'yj_field 采购订单行号', COUNT(*), SUM(CASE WHEN hidden=0 AND visible=1 THEN 1 ELSE 0 END) FROM yj_field WHERE label=N'采购订单行号'
UNION ALL SELECT N'yj_field 采购订单号(链上三站)', COUNT(*), NULL FROM yj_field WHERE label=N'采购订单号' AND panel_code IN ('SL_RECV','QC_INSP','PURCHASE_IN')
UNION ALL SELECT N'yj_translation 采购订单行号', COUNT(*), NULL FROM yj_translation WHERE ref_key=N'采购订单行号';
GO
PRINT N'migrate-po-chain-link 完成:采购链 采购订单号/采购订单行号 字段位已就绪';
GO
