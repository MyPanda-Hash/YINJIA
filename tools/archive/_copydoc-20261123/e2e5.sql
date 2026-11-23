SET NOCOUNT ON;
SELECT 单据编号+N' | 产品编号='+ISNULL(产品编号,N'∅')+N' | 产品名称='+ISNULL(产品名称,N'∅')+N' | 责任人='+ISNULL(责任人,N'∅')+N' | 客户编码='+ISNULL(客户编码,N'∅')+N' | 编辑人='+ISNULL(编辑人,N'∅') AS r FROM rd_prod_info_head WHERE 单据编号 IN (N'CP382',N'PI-2026-11-0007');
GO
SELECT 单据编号+N' 行='+CONVERT(varchar(10),COUNT(*)) AS r FROM rd_prod_info_detail WHERE 单据编号 IN (N'CP382',N'PI-2026-11-0007') GROUP BY 单据编号;
GO
SELECT doc_no+N' saved='+ISNULL(saved,N'∅')+N' archived='+ISNULL(archived,N'∅') AS r FROM yj_doc_status WHERE panel_code='RD_PROD_INFO' AND doc_no IN (N'CP382',N'PI-2026-11-0007');
GO
SELECT TOP 8 单据编号+N' | 序号='+ISNULL(CONVERT(varchar(10),序号),N'∅')+N' | 物料编号='+ISNULL(物料编号,N'∅')+N' | 数量='+ISNULL(数量,N'∅') AS r FROM rd_prod_info_detail WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
