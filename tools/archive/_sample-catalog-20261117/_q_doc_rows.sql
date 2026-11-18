SET NOCOUNT ON;
SELECT 'H' AS tag, 单据编号, 单据状态, 检验类别, 检验依据, 合计收费 FROM dbo.qc_insp_commission_head WHERE 单据编号 = N'WT-2026-11-9008';
SELECT 'D' AS tag, 单据编号, 行号, 检测元素, 内部检出限, 检测误差, 测试方法, 收费 FROM dbo.qc_insp_commission_detail WHERE 单据编号 = N'WT-2026-11-9008' ORDER BY 行号;
