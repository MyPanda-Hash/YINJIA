-- _q_qcinsp_cols.sql — qc_insp_detail 全列(不限行)+ 现有检验单的 送检数量/计量单位 实况 + 自动生单历史
SET NOCOUNT ON;
PRINT '── qc_insp_detail 全列 ──';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp_detail' ORDER BY ORDINAL_POSITION;
GO
PRINT '── qc_insp 全列 ──';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp' ORDER BY ORDINAL_POSITION;
GO
PRINT '── 现有检验单:送检数量/合格数量/单位 实况 ──';
SELECT TOP 10 单据编号, 物料编码, 送检数量, 合格数量, 单位, 采购订单行号 FROM qc_insp_detail ORDER BY id DESC;
GO
SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(送检数量,0)>0 THEN 1 ELSE 0 END) AS 送检数量有值,
       SUM(CASE WHEN ISNULL(合格数量,0)>0 THEN 1 ELSE 0 END) AS 合格数量有值 FROM qc_insp_detail;
GO
PRINT '── 采购入库单来源构成(自动生单是否真在跑) ──';
SELECT ISNULL(来源单据,N'(空)') AS 来源单据, COUNT(*) AS 单数 FROM bd_purchase_in GROUP BY 来源单据;
GO
PRINT '── 检验单来源构成 ──';
SELECT TOP 8 单据编号, 暂收单号, 采购订单号, 单据状态 FROM qc_insp ORDER BY id DESC;
GO
