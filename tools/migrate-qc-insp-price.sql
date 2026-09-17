-- migrate-qc-insp-price.sql — 来料检验单明细补"单价"字段(采购链单价流转打通)
-- 2026-09-17 用户反馈:暂收单→检验单没有单价字段,采购入库单拿不到单价。
--   链路:采购订单(单价)→SL_RECV(单价)→QC_INSP(缺!)→PURCHASE_IN(单价)。
--   本脚本补列+注册字段;此后同名自动映射打通两段:
--   SL_RECV→QC_INSP 选单/生单(单价→单价)与 QC_INSP→PURCHASE_IN 审核生单(单价→单价)。
--   SL_RECV 改单价同步检验单由 syncInspFromSlRecv 镜像(代码已同步补)。
-- 译名"单价"9 语言全局共享已有。幂等可重跑。
SET NOCOUNT ON;
GO
IF COL_LENGTH('dbo.qc_insp_detail', N'单价') IS NULL ALTER TABLE dbo.qc_insp_detail ADD [单价] decimal(18, 6) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_INSP' AND col_name = N'单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_INSP', N'单价', N'单价', N'小数', N'detail', 246, 100, 1, 0, 0, 1);
GO
-- 自检
SELECT panel_code, label, data_type, seq FROM yj_field
WHERE panel_code IN ('SL_RECV','QC_INSP') AND label = N'单价';
GO
PRINT N'migrate-qc-insp-price 完成';
GO
