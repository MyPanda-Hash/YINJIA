-- migrate-kingdee-order-align.sql — 销售订单(SO_ORDER)/采购订单(PU_ORDER)字段对齐金蝶ERP
-- 依据:deploy/sync-core.mjs mapHead/mapLines 现行映射 + deploy/面板字段对照.md §二/§三(sal_order/pur_order)。
-- 改动:
--   1. 无则加(物理列+字段):
--      bd_so_order 补 币种(currency)/汇率(exchange_rate)/结算期限(setting_term_name);
--      bd_pu_order 补 结算期限(setting_term_name);
--      SO 头补注册 备注(列已在);PU 头补注册 供应商编码(列已在);
--      PU 行补注册 数量2/计量单位2/折扣%/折扣金额/备注(列全在——jdy-sync 一直在写,界面此前看不见)。
--   2. 有则改(仅 label):SO「部门.负责人」→「部门负责人」(与列名一致,消除点号键)。
--   3. 同步锚点列收编进链(deploy/migrate-add-external-cols.sql 同款守卫,列已在则空跑)。
--   4. 新标签 9 语言译名(结算期限/部门负责人;其余新标签已有译名)。
-- 幂等:COL_LENGTH 守卫 / IF NOT EXISTS / MERGE NOT MATCHED,可重复执行。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ══ 1. 物理列 ══
IF COL_LENGTH('dbo.bd_so_order', N'币种') IS NULL ALTER TABLE dbo.bd_so_order ADD [币种] nvarchar(20) NULL;
IF COL_LENGTH('dbo.bd_so_order', N'汇率') IS NULL ALTER TABLE dbo.bd_so_order ADD [汇率] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bd_so_order', N'结算期限') IS NULL ALTER TABLE dbo.bd_so_order ADD [结算期限] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bd_pu_order', N'结算期限') IS NULL ALTER TABLE dbo.bd_pu_order ADD [结算期限] nvarchar(100) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bd_so_order') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bd_so_order'), N'币种', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'币别(金蝶星辰 sal_order.currency;名称对照待基础资料币别同步后经 id 解析)', N'SCHEMA', N'dbo', N'TABLE', N'bd_so_order', N'COLUMN', N'币种';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bd_so_order') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bd_so_order'), N'汇率', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'汇率(金蝶星辰 sal_order.exchange_rate)', N'SCHEMA', N'dbo', N'TABLE', N'bd_so_order', N'COLUMN', N'汇率';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bd_so_order') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bd_so_order'), N'结算期限', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'结算期限(金蝶星辰 setting_term_name)', N'SCHEMA', N'dbo', N'TABLE', N'bd_so_order', N'COLUMN', N'结算期限';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bd_pu_order') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bd_pu_order'), N'结算期限', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'结算期限(金蝶星辰 pur_order.setting_term_name)', N'SCHEMA', N'dbo', N'TABLE', N'bd_pu_order', N'COLUMN', N'结算期限';
GO

-- ══ 2. 同步锚点(收编 deploy/migrate-add-external-cols.sql 进迁移链;列已在则空跑) ══
IF COL_LENGTH('dbo.bd_so_order', N'外部数据ID') IS NULL ALTER TABLE dbo.bd_so_order ADD [外部数据ID] nvarchar(64) NULL;
IF COL_LENGTH('dbo.bd_so_order', N'外部单据号') IS NULL ALTER TABLE dbo.bd_so_order ADD [外部单据号] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bd_so_order', N'外部指纹') IS NULL ALTER TABLE dbo.bd_so_order ADD [外部指纹] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bd_pu_order', N'外部数据ID') IS NULL ALTER TABLE dbo.bd_pu_order ADD [外部数据ID] nvarchar(64) NULL;
IF COL_LENGTH('dbo.bd_pu_order', N'外部单据号') IS NULL ALTER TABLE dbo.bd_pu_order ADD [外部单据号] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bd_pu_order', N'外部指纹') IS NULL ALTER TABLE dbo.bd_pu_order ADD [外部指纹] nvarchar(500) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bd_so_order_ext_id')
    CREATE UNIQUE INDEX ux_bd_so_order_ext_id ON dbo.bd_so_order([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bd_pu_order_ext_id')
    CREATE UNIQUE INDEX ux_bd_pu_order_ext_id ON dbo.bd_pu_order([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
GO

-- ══ 3. 有则改:SO 部门.负责人 → 部门负责人 ══
UPDATE yj_field SET label = N'部门负责人' WHERE panel_code = 'SO_ORDER' AND col_name = N'部门负责人' AND label = N'部门.负责人';
GO

-- ══ 4. 无则加:yj_field(SO 头:币种/汇率/结算期限/备注;PU 头:供应商编码/结算期限;PU 行:数量2/计量单位2/折扣%/折扣金额/备注) ══
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'币种')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
    VALUES ('SO_ORDER', N'币种', N'币种', N'下拉框', N'SELECT 名称 FROM bs_currency WHERE ISNULL(asp_cancel,''N'')<>''Y'' AND ISNULL(停用,0)<>1', N'header', 52, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'汇率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('SO_ORDER', N'汇率', N'汇率', N'小数', N'header', 54, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'结算期限')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('SO_ORDER', N'结算期限', N'结算期限', N'文本', N'header', 84, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'备注' AND place=N'header')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('SO_ORDER', N'备注', N'备注', N'文本', N'header', 150, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'备注' AND place=N'header')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('PU_ORDER', N'备注', N'备注', N'文本', N'header', 140, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('PU_ORDER', N'供应商编码', N'供应商编码', N'文本', N'header', 45, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'结算期限')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('PU_ORDER', N'结算期限', N'结算期限', N'文本', N'header', 65, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'数量2')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('PU_ORDER', N'数量2', N'数量2', N'小数', N'detail', 55, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'计量单位2')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('PU_ORDER', N'计量单位2', N'计量单位2', N'文本', N'detail', 57, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'折扣%')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('PU_ORDER', N'折扣%', N'折扣%', N'小数', N'detail', 145, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'折扣金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('PU_ORDER', N'折扣金额', N'折扣金额', N'小数', N'detail', 147, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'备注' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('PU_ORDER', N'备注', N'备注', N'文本', N'detail', 160, 200, 1, 0, 0, 1);
GO

-- ══ 5. 新标签译名(9 语言;其余标签已有译名免插) ══
MERGE yj_translation AS t USING (VALUES
(N'field', N'结算期限', N'en', N'Settlement Term'),
(N'field', N'结算期限', N'ja', N'支払条件'),
(N'field', N'结算期限', N'ko', N'결제 조건'),
(N'field', N'结算期限', N'de', N'Zahlungsziel'),
(N'field', N'结算期限', N'es', N'Plazo de liquidación'),
(N'field', N'结算期限', N'fr', N'Délai de règlement'),
(N'field', N'结算期限', N'ru', N'Условия расчета'),
(N'field', N'结算期限', N'th', N'ระยะเวลาชำระ'),
(N'field', N'结算期限', N'vi', N'Kỳ hạn thanh toán'),
(N'field', N'部门负责人', N'en', N'Dept. Manager'),
(N'field', N'部门负责人', N'ja', N'部門責任者'),
(N'field', N'部门负责人', N'ko', N'부서 담당자'),
(N'field', N'部门负责人', N'de', N'Abteilungsleiter'),
(N'field', N'部门负责人', N'es', N'Responsable de departamento'),
(N'field', N'部门负责人', N'fr', N'Responsable du département'),
(N'field', N'部门负责人', N'ru', N'Руководитель отдела'),
(N'field', N'部门负责人', N'th', N'หัวหน้าแผนก'),
(N'field', N'部门负责人', N'vi', N'Trưởng phòng')
) AS s(scope, ref_key, locale, text)
ON t.scope = s.scope AND t.ref_key = s.ref_key AND t.locale = s.locale
WHEN NOT MATCHED THEN INSERT (scope, ref_key, locale, text, source) VALUES (s.scope, s.ref_key, s.locale, s.text, 'manual');
GO

-- ══ 6. 自检 ══
SELECT N'bd_so_order' AS tbl, name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_so_order') AND name IN (N'币种',N'汇率',N'结算期限',N'外部数据ID');
SELECT N'bd_pu_order' AS tbl, name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_pu_order') AND name IN (N'结算期限',N'外部数据ID');
SELECT panel_code, col_name, label, place FROM yj_field WHERE panel_code IN ('SO_ORDER','PU_ORDER')
AND col_name IN (N'币种',N'汇率',N'结算期限',N'备注',N'供应商编码',N'数量2',N'计量单位2',N'折扣%',N'折扣金额',N'部门负责人') ORDER BY panel_code, place, seq;
SELECT s.ref_key + N'(field)' AS 译名键, s.expected - ISNULL(t.n,0) AS 缺口 FROM (VALUES (N'结算期限',9),(N'部门负责人',9)) AS s(ref_key, expected)
LEFT JOIN (SELECT ref_key, COUNT(*) n FROM yj_translation WHERE scope='field' AND locale IN ('en','ja','ko','de','es','fr','ru','th','vi')
AND ref_key IN (N'结算期限',N'部门负责人') GROUP BY ref_key) t ON t.ref_key = s.ref_key;
PRINT N'migrate-kingdee-order-align 完成';
GO
