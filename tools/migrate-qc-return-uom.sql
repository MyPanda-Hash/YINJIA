-- migrate-qc-return-uom.sql — 暂收退料单明细补"计量单位"字段(采购链单位流转补全)
-- 2026-09-17 用户需求:采购订单(单位)→送料暂收单→来料检验单→暂收退料单→采购入库单(计量单位)
--   全链流转单位。四单已有单位/计量单位字段,唯 QC_RETURN 缺——检验不良行生退料单时
--   同名映射(detailMap)无处落,单位断流。本脚本补列+注册字段:
--   链路映射 PU_ORDER"单位"→SL_RECV/QC_INSP/QC_RETURN/PURCHASE_IN"计量单位"由
--   FLOW_DETAIL_SYNONYMS 既有词条({"单位","计量单位"})与同名自动映射支持,零代码改动。
-- 译名"计量单位"9 语言全局共享已有。幂等可重跑。
SET NOCOUNT ON;
GO
IF COL_LENGTH('dbo.qc_return_detail', N'计量单位') IS NULL ALTER TABLE dbo.qc_return_detail ADD [计量单位] nvarchar(50) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_RETURN' AND col_name = N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_RETURN', N'计量单位', N'计量单位', N'文本', N'detail', 245, 90, 1, 0, 0, 1);
GO
-- 自检:五单据明细单位类字段齐备
SELECT panel_code, label, seq FROM yj_field
WHERE panel_code IN ('PU_ORDER','SL_RECV','QC_INSP','QC_RETURN','PURCHASE_IN')
  AND label IN (N'单位', N'计量单位') AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
ORDER BY CASE panel_code WHEN 'PU_ORDER' THEN 1 WHEN 'SL_RECV' THEN 2 WHEN 'QC_INSP' THEN 3 WHEN 'QC_RETURN' THEN 4 ELSE 5 END;
GO
PRINT N'migrate-qc-return-uom 完成';
GO
