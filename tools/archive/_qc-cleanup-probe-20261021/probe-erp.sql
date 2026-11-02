SET NOCOUNT ON;
SELECT '=== qc_return erp fields ===' AS x;
SELECT TOP 20 单据编号,是否已转ERP,ERP单号,转ERP操作人,转ERP时间,单据状态,审核人,审核时间,审批人,审批时间 FROM qc_return ORDER BY 单据编号 DESC;
GO
SELECT '=== qc_return columns erp ===' AS x;
SELECT c.name, ty.name typ, c.max_length FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('qc_return') AND (c.name LIKE '%ERP%' OR c.name LIKE '%审核%' OR c.name LIKE '%审批%') ORDER BY c.column_id;
GO
SELECT '=== any pushed docs ===' AS x;
SELECT TOP 20 单据编号,是否已转ERP,ERP单号,转ERP操作人,转ERP时间 FROM bd_purchase_in WHERE ISNULL(是否已转ERP,N'')<>N'' AND 是否已转ERP<>N'否' ORDER BY id DESC;
GO
SELECT '=== approval table ===' AS x;
SELECT t.name FROM sys.tables t WHERE t.name LIKE '%approval%';
GO
SELECT '=== yj_form_approval cols ===' AS x;
SELECT c.name, ty.name typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_form_approval') ORDER BY c.column_id;
GO
SELECT '=== qc_return approval sample ===' AS x;
SELECT TOP 20 * FROM yj_form_approval WHERE panel_code='QC_RETURN' ORDER BY id DESC;
GO
