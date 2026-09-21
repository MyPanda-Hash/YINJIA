SET NOCOUNT ON;
PRINT N'=== 采购链单据状态汇总 ===';
SELECT panel_code, COUNT(*) AS 单数,
       SUM(CASE WHEN ISNULL(shr,'')<>'' THEN 1 ELSE 0 END) AS 已审核,
       SUM(CASE WHEN ISNULL(cancel_by,'')<>'' THEN 1 ELSE 0 END) AS 已弃审,
       MAX(CONVERT(varchar(19), shsj, 120)) AS 最近审核时间
FROM yj_doc_status
WHERE panel_code IN ('PU_ORDER','QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN','QC_TC','OTHER_IN','OTHER_OUT')
GROUP BY panel_code ORDER BY panel_code;
GO
PRINT N'=== 采购入库单 转ERP 标记分布 ===';
SELECT [是否已转ERP] AS 转ERP标记, COUNT(*) AS 单数,
       SUM(CASE WHEN ISNULL([ERP单号],'')<>'' THEN 1 ELSE 0 END) AS 有ERP单号
FROM bd_purchase_in GROUP BY [是否已转ERP];
GO
PRINT N'=== 暂收/检验 单据状态取值抽样 ===';
SELECT TOP 20 panel_code, doc_no, saved, canceled, shr, CONVERT(varchar(19), shsj, 120) AS shsj
FROM yj_doc_status WHERE panel_code IN ('QC_RECV','QC_INSP') ORDER BY doc_no;
GO
