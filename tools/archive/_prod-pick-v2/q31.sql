SET NOCOUNT ON;
SELECT panel_code, doc_no, ISNULL(shr,'') shr, ISNULL(canceled,'') canceled, ISNULL(stopped,'') stopped FROM yj_doc_status WHERE doc_no='LL-2026-10-0004';
GO
SELECT 单据编号, 材料编码, 数量 FROM outh WHERE 单据编号='LL-2026-10-0004';
GO
SELECT TOP 4 单据编号, 业务类型 FROM bd_material_out ORDER BY id DESC;
GO
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('bd_other_in') AND name LIKE '%单据状态%';
