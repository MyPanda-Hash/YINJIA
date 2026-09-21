SET NOCOUNT ON;
-- 每张单的明细行数 + 头字段是否有实质内容(判断"空壳草稿"用)
SELECT N'MP' AS 类, h.单据编号, ISNULL(h.产品编号,N'') AS 产品编号, ISNULL(h.产品名称,N'') AS 名称,
       (SELECT COUNT(*) FROM rd_mold_proc_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行
  FROM rd_mold_proc_head h ORDER BY h.id;
GO
SELECT N'AP' AS 类, h.单据编号, ISNULL(h.产品编号,N'') AS 产品编号, ISNULL(h.产品名称,N'') AS 名称,
       (SELECT COUNT(*) FROM rd_asm_proc_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行
  FROM rd_asm_proc_head h ORDER BY h.id;
GO
SELECT N'SD' AS 类, h.单据编号, ISNULL(h.编号,N'') AS 产品编号, ISNULL(h.名称,N'') AS 名称,
       (SELECT COUNT(*) FROM rd_spec_doc_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行
  FROM rd_spec_doc_head h ORDER BY h.id;
GO
SELECT N'IP' AS 类, h.单据编号, ISNULL(h.产品编号,N'') AS 产品编号, ISNULL(h.标题,N'') AS 名称,
       (SELECT COUNT(*) FROM rd_insp_plan_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行
  FROM rd_insp_plan_head h ORDER BY h.id;
GO
SELECT N'PI' AS 类, h.单据编号, ISNULL(h.产品编号,N'') AS 产品编号, ISNULL(h.产品名称,N'') AS 名称, 0 AS 明细行
  FROM rd_prod_info_head h ORDER BY h.id;
GO
SELECT N'CHG' AS 类, h.单据编号, ISNULL(h.产品编号,N'') AS 产品编号, ISNULL(h.变更事由,N'') AS 名称, 0 AS 明细行
  FROM rd_change_head h ORDER BY h.id;
GO
-- 状态/留痕/消息里有多少孤儿(引用的单据已不存在)
SELECT N'状态行' AS 项, COUNT(*) AS 行数 FROM yj_doc_status s
 WHERE NOT EXISTS (SELECT 1 FROM rd_mold_proc_head x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_asm_proc_head x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_spec_doc_head x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_insp_plan_head x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_prod_info_head x WHERE x.单据编号 = s.doc_no)
   AND NOT EXISTS (SELECT 1 FROM rd_change_head x WHERE x.单据编号 = s.doc_no)
   AND s.panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'留痕行(RD)', COUNT(*) FROM yj_form_approval WHERE panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'消息(RD)', COUNT(*) FROM yj_message WHERE 面板编码 LIKE N'RD[_]%';
GO
