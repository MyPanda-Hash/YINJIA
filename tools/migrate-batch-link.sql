-- migrate-batch-link.sql — 采购订单分批送料:批次台账 + 批次号字段(P0 结构 / 元数据 / 译名)
-- 方案:docs/方案-采购订单分批送料与批次号.md(决策 2026-09-20)
--   ① 系统参数表 yj_app_setting:存"收料超送比例"等运行期口径(原先库内无参数表)
--   ② 批次台账 yj_doc_batch:每张暂收单一个批次(批次号=采购订单号+3位序号,序号可回收)
--   ③ form_flow_link 加 batch_no:占用按批次记录,linked_quantity = **本次实际送料量**(原为整行量)
--   ④ 暂收/检验/入库/退回 四张单(头+行)加 批次号 列,批次号沿链路贯通
--   ⑤ yj_field 注册 + yj_translation 10 语言
-- 幂等:判存再建/加,元数据清旧插新,词条 NOT EXISTS。
SET NOCOUNT ON;

-- ══════════════════════ 1. 系统参数表(超送比例) ══════════════════════
IF OBJECT_ID('yj_app_setting') IS NULL
CREATE TABLE yj_app_setting (
    setting_key   nvarchar(100) NOT NULL CONSTRAINT PK_yj_app_setting PRIMARY KEY,
    setting_value nvarchar(200) NULL,
    remark        nvarchar(400) NULL,
    asp_user1     nvarchar(60)  NULL,
    asp_time1     datetime2     NULL CONSTRAINT DF_yj_app_setting_t1 DEFAULT SYSDATETIME(),
    asp_time2     datetime2     NULL
);
GO
IF OBJECT_ID('dbo.yj_app_setting') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.yj_app_setting') AND minor_id=0 AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'系统参数表(键值对:收料超送比例等运行期可调口径,见 remark)', N'SCHEMA',N'dbo',N'TABLE',N'yj_app_setting';
IF OBJECT_ID('dbo.yj_app_setting') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.yj_app_setting') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.yj_app_setting'),'setting_key','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'参数键(如 receive_over_ratio=收料超送比例)', N'SCHEMA',N'dbo',N'TABLE',N'yj_app_setting',N'COLUMN',N'setting_key';
IF OBJECT_ID('dbo.yj_app_setting') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.yj_app_setting') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.yj_app_setting'),'setting_value','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'参数值(字符串;比例按 0~1 小数存)', N'SCHEMA',N'dbo',N'TABLE',N'yj_app_setting',N'COLUMN',N'setting_value';
GO
-- 默认允许超送 5%(0 = 不允许)
IF NOT EXISTS (SELECT 1 FROM yj_app_setting WHERE setting_key = N'receive_over_ratio')
    INSERT INTO yj_app_setting (setting_key, setting_value, remark)
    VALUES (N'receive_over_ratio', N'0.05', N'收料允许超送比例(0~1;0=不允许)。分批送料校验:本次送料量 ≤ 剩余量 ×(1+比例)');
GO

-- ══════════════════════ 2. 批次台账 yj_doc_batch ══════════════════════
IF OBJECT_ID('yj_doc_batch') IS NULL
CREATE TABLE yj_doc_batch (
    id                int IDENTITY(1,1) NOT NULL CONSTRAINT PK_yj_doc_batch PRIMARY KEY,
    source_panel_code nvarchar(50)  NOT NULL,   -- 来源面板(采购订单 PU_ORDER)
    source_form_no    nvarchar(100) NOT NULL,   -- 来源单号(采购订单号)
    batch_seq         int           NOT NULL,   -- 该订单内批次序号(1,2,3…;可回收)
    batch_no          nvarchar(50)  NOT NULL,   -- 批次号 = 采购订单号 + '-' + 3位序号
    batch_qty         decimal(18,4) NOT NULL CONSTRAINT DF_yj_doc_batch_qty DEFAULT 0, -- 本批次送料数量合计
    status            nvarchar(20)  NOT NULL CONSTRAINT DF_yj_doc_batch_st DEFAULT N'ACTIVE', -- ACTIVE/RELEASED
    target_panel_code nvarchar(50)  NULL,       -- 生成的下游单据面板(送料暂收单 SL_RECV)
    target_form_no    nvarchar(100) NULL,       -- 生成的下游单据号
    create_by         nvarchar(60)  NULL,
    create_time       datetime2     NULL CONSTRAINT DF_yj_doc_batch_ct DEFAULT SYSDATETIME(),
    release_time      datetime2     NULL,
    remark            nvarchar(400) NULL
);
GO
IF OBJECT_ID('dbo.yj_doc_batch') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.yj_doc_batch') AND minor_id=0 AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'采购订单送料批次台账(每张暂收单一个批次;批次号=订单号+3位序号,序号在草稿删除后回收)', N'SCHEMA',N'dbo',N'TABLE',N'yj_doc_batch';
GO
DECLARE @t sysname = 'yj_doc_batch', @c sysname, @d nvarchar(300), @ex int;
DECLARE c1 CURSOR LOCAL FAST_FORWARD FOR SELECT * FROM (VALUES
    (N'source_form_no', N'来源单号(采购订单号)'),
    (N'batch_seq',      N'该订单内批次序号(1,2,3…;释放后序号回到可用池,可被新批次复用)'),
    (N'batch_no',       N'批次号(采购订单号-3位序号,贯通暂收/检验/入库/退回;已作废释放的批次行保留留痕)'),
    (N'batch_qty',      N'本批次送料数量合计'),
    (N'status',         N'批次状态:ACTIVE 有效(占号) / RELEASED 已释放(序号可复用)'),
    (N'target_form_no', N'生成的下游单据号(送料暂收单)')
) v(c, d);
OPEN c1; FETCH NEXT FROM c1 INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.'+@t) AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.'+@t),@c,'ColumnId') AND name='MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @d, N'SCHEMA',N'dbo',N'TABLE',@t,N'COLUMN',@c;
    FETCH NEXT FROM c1 INTO @c, @d;
END
CLOSE c1; DEALLOCATE c1;
GO
-- 序号唯一性:**只对"有效批次(ACTIVE)"唯一** —— 已作废/删除释放的批次行保留留痕(状态 RELEASED),
-- 其序号回到可用池可被新批次复用(用户口径:批次号要回收);故用筛选唯一索引而非普通唯一索引。
IF OBJECT_ID('dbo.yj_doc_batch') IS NOT NULL AND EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_yj_doc_batch_seq' AND object_id=OBJECT_ID('dbo.yj_doc_batch'))
    DROP INDEX UX_yj_doc_batch_seq ON yj_doc_batch;
GO
-- 2026-09-23 合并重放修复:历史上无唯一索引期间,库内可能已产生同 (source_panel_code, source_form_no,
-- batch_seq) 的多条 ACTIVE 行(实测本地库 PU_ORDER|YJ-20260909-01|1 重复)——先留最新一条 ACTIVE,
-- 其余置 RELEASED(保留 target 链路留痕,符合"RELEASED=序号可复用"语义),否则筛选唯一索引建不起来。
IF OBJECT_ID('dbo.yj_doc_batch') IS NOT NULL
UPDATE b SET b.status = 'RELEASED'
  FROM yj_doc_batch b
  JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY source_panel_code, source_form_no, batch_seq
                                        ORDER BY id DESC) AS rn
          FROM yj_doc_batch WHERE status = 'ACTIVE') t ON t.id = b.id AND t.rn > 1;
GO
IF OBJECT_ID('dbo.yj_doc_batch') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_yj_doc_batch_active' AND object_id=OBJECT_ID('dbo.yj_doc_batch'))
    CREATE UNIQUE INDEX UX_yj_doc_batch_active ON yj_doc_batch (source_panel_code, source_form_no, batch_seq) WHERE status = 'ACTIVE';
GO
IF OBJECT_ID('dbo.yj_doc_batch') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_yj_doc_batch_no' AND object_id=OBJECT_ID('dbo.yj_doc_batch'))
    CREATE INDEX IX_yj_doc_batch_no ON yj_doc_batch (batch_no) INCLUDE (target_panel_code, target_form_no);
GO
IF OBJECT_ID('dbo.yj_doc_batch') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_yj_doc_batch_target' AND object_id=OBJECT_ID('dbo.yj_doc_batch'))
    CREATE INDEX IX_yj_doc_batch_target ON yj_doc_batch (target_panel_code, target_form_no);
GO

-- ══════════════════════ 3. form_flow_link 加 batch_no ══════════════════════
IF COL_LENGTH('dbo.form_flow_link', N'batch_no') IS NULL ALTER TABLE form_flow_link ADD batch_no nvarchar(50) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.form_flow_link') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.form_flow_link'),'batch_no','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'占用的送料批次号(分批送料:同一来源行可分多批次占用,linked_quantity=各批次实际送料量)', N'SCHEMA',N'dbo',N'TABLE',N'form_flow_link',N'COLUMN',N'batch_no';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_ffl_batch' AND object_id=OBJECT_ID('dbo.form_flow_link'))
    CREATE INDEX idx_ffl_batch ON form_flow_link (batch_no) INCLUDE (source_panel_code, source_form_no, target_panel_code, target_form_no);
GO

-- ══════════════════════ 4. 四张单(头+行)加 批次号 列 ══════════════════════
IF COL_LENGTH('dbo.sl_recv', N'批次号') IS NULL ALTER TABLE sl_recv ADD [批次号] nvarchar(50) NULL;
IF COL_LENGTH('dbo.sl_recv_detail', N'批次号') IS NULL ALTER TABLE sl_recv_detail ADD [批次号] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_insp', N'批次号') IS NULL ALTER TABLE qc_insp ADD [批次号] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'批次号') IS NULL ALTER TABLE qc_insp_detail ADD [批次号] nvarchar(50) NULL;
IF COL_LENGTH('dbo.bd_purchase_in', N'批次号') IS NULL ALTER TABLE bd_purchase_in ADD [批次号] nvarchar(50) NULL;
IF COL_LENGTH('dbo.bl_purchase_in', N'批次号') IS NULL ALTER TABLE bl_purchase_in ADD [批次号] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_return', N'批次号') IS NULL ALTER TABLE qc_return ADD [批次号] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_return_detail', N'批次号') IS NULL ALTER TABLE qc_return_detail ADD [批次号] nvarchar(50) NULL;
GO
DECLARE @t2 sysname, @c2 sysname;
DECLARE c2 CURSOR LOCAL FAST_FORWARD FOR SELECT * FROM (VALUES
    ('sl_recv'),('sl_recv_detail'),('qc_insp'),('qc_insp_detail'),
    ('bd_purchase_in'),('bl_purchase_in'),('qc_return'),('qc_return_detail')
) v(t);
OPEN c2; FETCH NEXT FROM c2 INTO @t2;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH('dbo.'+@t2, N'批次号') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.'+@t2) AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.'+@t2),'批次号','ColumnId') AND name='MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'送料批次号(采购订单分批送料:批次号=采购订单号+3位序号;由生单自动生成,贯通暂收/检验/入库/退回)', N'SCHEMA',N'dbo',N'TABLE',@t2,N'COLUMN',N'批次号';
    FETCH NEXT FROM c2 INTO @t2;
END
CLOSE c2; DEALLOCATE c2;
GO

-- ══════════════════════ 5. yj_field 注册 批次号 ══════════════════════
-- 头:place=query,header(紧跟在「采购订单号」之后);行:place=detail(紧跟「采购订单行号」之后)
DELETE FROM yj_field WHERE col_name = N'批次号' AND panel_code IN ('SL_RECV','QC_INSP','QC_RETURN','PURCHASE_IN')
  AND (place = N'query,header' OR place = N'detail');
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('SL_RECV',      N'批次号', N'批次号', N'文本', NULL,NULL,NULL,NULL, N'query,header', 125, 160, 1, 0, 0, 1),
('SL_RECV',      N'批次号', N'批次号', N'文本', NULL,NULL,NULL,NULL, N'detail',       225, 150, 1, 0, 0, 1),
('QC_INSP',      N'批次号', N'批次号', N'文本', NULL,NULL,NULL,NULL, N'query,header',  36, 160, 1, 0, 0, 1),
('QC_INSP',      N'批次号', N'批次号', N'文本', NULL,NULL,NULL,NULL, N'detail',       210, 150, 1, 0, 0, 1),
('QC_RETURN',    N'批次号', N'批次号', N'文本', NULL,NULL,NULL,NULL, N'query,header',  36, 160, 1, 0, 0, 1),
('QC_RETURN',    N'批次号', N'批次号', N'文本', NULL,NULL,NULL,NULL, N'detail',       206, 150, 1, 0, 0, 1),
('PURCHASE_IN',  N'批次号', N'批次号', N'文本', NULL,NULL,NULL,NULL, N'query,header', 255, 160, 1, 0, 0, 1),
('PURCHASE_IN',  N'批次号', N'批次号', N'文本', NULL,NULL,NULL,NULL, N'detail',       310, 150, 1, 0, 0, 1);
GO

-- ══════════════════════ 6. 译名 批次号 × 10 语言 ══════════════════════
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'批次号', t.locale, t.txt, 'manual'
FROM (VALUES ('en', N'Batch No.'), ('ja', N'バッチ番号'), ('ko', N'배치 번호'), ('de', N'Chargennummer'),
             ('fr', N'N° de lot'), ('es', N'N.º de lote'), ('ru', N'Номер партии'), ('vi', N'Số lô'),
             ('th', N'เลขที่ล็อต'), ('zh-TW', N'批次號')) t(locale, txt)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope='field' AND x.ref_key=N'批次号' AND x.locale=t.locale);
GO

-- ══════════════════════ 7. 自检 ══════════════════════
SELECT
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('yj_app_setting','yj_doc_batch')) AS 新表数,
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('sl_recv','sl_recv_detail','qc_insp','qc_insp_detail','bd_purchase_in','bl_purchase_in','qc_return','qc_return_detail') AND COLUMN_NAME=N'批次号') AS 批次号列数,
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='form_flow_link' AND COLUMN_NAME='batch_no') AS link批次列,
  (SELECT COUNT(*) FROM yj_field WHERE col_name=N'批次号' AND panel_code IN ('SL_RECV','QC_INSP','QC_RETURN','PURCHASE_IN')) AS 字段行数,
  (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key=N'批次号') AS 译名数,
  (SELECT setting_value FROM yj_app_setting WHERE setting_key=N'receive_over_ratio') AS 超送比例;
GO
PRINT N'migrate-batch-link 完成:批次台账 + form_flow_link.batch_no + 8 处批次号列 + 元数据 + 译名 + 超送比例参数';
GO
