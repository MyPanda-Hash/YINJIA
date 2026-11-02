SET NOCOUNT ON;
-- 组装工艺清单正确落点:rd_asm_proc_detail 里 表区='物料清单' 的行
SELECT h.单据编号, h.产品编号, d.表区, d.物料编号, d.物料名, d.用量
  FROM rd_asm_proc_head h JOIN rd_asm_proc_detail d ON d.单据编号 = h.单据编号
 WHERE d.表区 = N'物料清单';
GO
SELECT '组装工艺清单头' k, COUNT(*) n FROM rd_asm_proc_head
UNION ALL SELECT '组装工艺清单行', COUNT(*) FROM rd_asm_proc_detail
UNION ALL SELECT '组装BOM表头(已下线)', COUNT(*) FROM rd_asm_bom_head;
