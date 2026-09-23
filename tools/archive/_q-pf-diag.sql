SET NOCOUNT ON;
-- 规格书单据与状态行(看"审批通过"为何说不在审批中)
SELECT 单据编号, ISNULL(编号,N'-') AS 编号字段, ISNULL(名称,N'-') AS 名称, ISNULL(变更来源单号,N'-') AS 来源, ISNULL(asp_user1,'-') AS 制单
  FROM rd_spec_doc_head WHERE 单据编号 LIKE N'SD-%' OR 编号 LIKE N'T-PF-%' ORDER BY id;
GO
SELECT doc_no, ISNULL(pending,'-') AS pending, ISNULL(archived,'-') AS arch, ISNULL(shr,'-') AS shr, ISNULL(saved,'-') AS saved, ISNULL(approve_node,'-') AS node
  FROM yj_doc_status WHERE panel_code = N'RD_SPEC_DOC' ORDER BY id DESC;
GO
-- 成型工艺清单:该产品的所有单据(⑤ 门禁探针创建的那张也要看清)
SELECT 单据编号, ISNULL(产品编号,N'-') AS 产品, ISNULL(变更来源单号,N'(无)') AS 来源, ISNULL(asp_user1,'-') AS 制单, CONVERT(nvarchar(19), asp_time1, 120) AS 建立时间
  FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PF-%' ORDER BY id;
GO
