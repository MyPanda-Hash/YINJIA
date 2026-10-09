SET NOCOUNT ON;
SELECT N'--- yj_doc_status 列 ---' AS s;
SELECT c.name AS col FROM sys.columns c WHERE c.object_id = OBJECT_ID('yj_doc_status') ORDER BY c.column_id;

SELECT N'--- MATERIAL_OUT 单据状态 ---' AS s;
SELECT * FROM yj_doc_status WHERE panel_code = 'MATERIAL_OUT';

SELECT N'--- bl_material_out 全列(CL-2026-10-0001) ---' AS s;
SELECT * FROM bl_material_out WHERE 单据编号 = 'CL-2026-10-0001';

SELECT N'--- 材料编码 原文核对 ---' AS s;
SELECT 单据编号, id, '[' + ISNULL(材料编码,'<NULL>') + ']' AS 材料编码原文,
       LEN(ISNULL(材料编码,'')) AS 长度, DATALENGTH(ISNULL(材料编码,'')) AS 字节数,
       '[' + ISNULL(计量单位,'<NULL>') + ']' AS 计量单位原文, '[' + ISNULL(单位id,'<NULL>') + ']' AS 单位id原文,
       '[' + ISNULL(批号,'<NULL>') + ']' AS 批号原文
FROM bl_material_out WHERE 单据编号 LIKE 'CL-2026-10%';

SELECT N'--- 头表全列(两张单) ---' AS s;
SELECT * FROM bd_material_out WHERE 单据编号 LIKE 'CL-2026-10-%';
