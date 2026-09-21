SET NOCOUNT ON;
SELECT 单据编号, ISNULL(产品编号,N'-') AS 产品, ISNULL(asp_cancel,'N') AS 软删 FROM rd_mold_proc_head ORDER BY id DESC;
GO
SELECT panel_code, doc_no, ISNULL(canceled,'-') AS canceled, ISNULL(deleting,'-') AS deleting, ISNULL(archived,'-') AS arch FROM yj_doc_status WHERE panel_code=N'RD_MOLD_PROC' ORDER BY id DESC;
GO
