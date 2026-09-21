SET NOCOUNT ON;
PRINT N'=== yj_doc_status 列结构 ===';
SELECT c.column_id, c.name AS 列名, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id = OBJECT_ID('yj_doc_status') ORDER BY c.column_id;
GO
PRINT N'=== 采购链单据状态汇总 ===';
SELECT panel_code, COUNT(*) AS 单数,
       SUM(CASE WHEN ISNULL(saved,0)=1 THEN 1 ELSE 0 END) AS 已保存,
       SUM(CASE WHEN ISNULL(shr,'')<>'' THEN 1 ELSE 0 END) AS 已审核,
       MAX(CONVERT(varchar(19), audit_at, 120)) AS 最近审核时间
FROM yj_doc_status
WHERE panel_code IN ('PU_ORDER','QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN','QC_TC','OTHER_IN','OTHER_OUT')
GROUP BY panel_code ORDER BY panel_code;
GO
PRINT N'=== 采购入库单 转ERP 字段非空统计 ===';
SELECT COUNT(*) AS 入库单数,
       SUM(CASE WHEN ISNULL(erp_bill_no,'')<>'' THEN 1 ELSE 0 END) AS 有ERP单号
FROM bd_purchase_in;
GO
