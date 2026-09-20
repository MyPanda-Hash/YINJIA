-- migrate-sl-chain-fixes.sql — 采购→暂收→检验→入库链路六项修复(数据部分)
-- 2026-09-17 用户反馈:
--  ① 采购订单→暂收单丢失供应商编码(FLOW_HEAD_SYNONYMS 已补代码,此处无数据项)
--  ② 采购入库单仓库名称无必填 → required=1
--  ③ 检验单 合格+不良≤数量 校验(ButtonService.validateInspQty 已补代码)
--  ④ 创建时间自动填(ButtonService 已补代码)
--  ⑤ 计量单位随商品带入:SL_RECV/QC_INSP 明细补"计量单位"字段(列+yj_field);
--    参照带回为同名自动映射(buildRefMap),INV 档案已有"计量单位"字段,注册后选物料即带入
--  ⑥ 选供应商填编码:PU_ORDER/PURCHASE_IN 头"供应商"参照 ref_field dm(编码)→mc(名称)——
--    列内既有数据与金蝶同步口径均为名称,存编码口径自相矛盾
-- 译名:计量单位(9 语言)与既有字段共享,无需新增。幂等可重跑。
SET NOCOUNT ON;
GO
-- ══ ② 采购入库单 仓库名称必填 ══
UPDATE yj_field SET required = 1 WHERE panel_code = 'PURCHASE_IN' AND label = N'仓库名称' AND ISNULL(required, 0) = 0;

-- ══ ⑤ SL_RECV/QC_INSP 明细补 计量单位 列与字段 ══
IF COL_LENGTH('dbo.sl_recv_detail', N'计量单位') IS NULL ALTER TABLE dbo.sl_recv_detail ADD [计量单位] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'计量单位') IS NULL ALTER TABLE dbo.qc_insp_detail ADD [计量单位] nvarchar(50) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SL_RECV' AND col_name = N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('SL_RECV', N'计量单位', N'计量单位', N'文本', N'detail', 70, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_INSP' AND col_name = N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_INSP', N'计量单位', N'计量单位', N'文本', N'detail', 245, 90, 1, 0, 0, 1);

-- ══ ⑥ 供应商参照存名称(编码列另由带回映射填) ══
UPDATE yj_field SET ref_field = 'mc', display_field = 'mc'
WHERE panel_code IN ('PU_ORDER', 'PURCHASE_IN') AND label = N'供应商' AND ref_panel = 'GFDA' AND ISNULL(ref_field, '') <> 'mc';
GO
-- 自检
SELECT panel_code, label, required FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND label = N'仓库名称';
SELECT panel_code, col_name, seq FROM yj_field WHERE col_name = N'计量单位' AND panel_code IN ('SL_RECV', 'QC_INSP');
SELECT panel_code, ref_field, display_field FROM yj_field WHERE label = N'供应商' AND panel_code IN ('PU_ORDER', 'PURCHASE_IN');
GO
PRINT N'migrate-sl-chain-fixes 完成';
GO
