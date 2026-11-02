SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('rd_mold_proc_head')
   AND c.name IN ('产品编号','产品名称','生产车间','工序','表区','单据编号','asp_cancel');
GO
-- 成型工艺清单里有没有 BOM 明细(哪怕空表,看结构)
SELECT (SELECT COUNT(*) FROM rd_mold_proc_head) head_rows,
       (SELECT COUNT(*) FROM rd_mold_proc_detail) det_rows,
       (SELECT COUNT(*) FROM rd_asm_proc_head) asm_head,
       (SELECT COUNT(*) FROM rd_asm_proc_detail) asm_det;
GO
-- 产品信息表 BOM
SELECT TOP 5 h.单据编号, h.产品编号, d.序号, d.物料编号, d.物料名称, d.数量
  FROM rd_prod_info_head h JOIN rd_prod_info_detail d ON d.单据编号=h.单据编号;
GO
-- 一个工单例子:GD-2026-10-0002 的全部行
SELECT id, pl_no, pl_xc, dm, mc, pl_sl, scx, 工艺路线, 当前工序, asp_cancel FROM plang WHERE pl_no='GD-2026-10-0002';
GO
-- 已有材料出库单样例
SELECT TOP 5 单据编号, 加工单号, 工单行号, 业务类型, 出库类别, 领用人, 仓库 FROM bd_material_out ORDER BY id DESC;
GO
SELECT TOP 8 单据编号, 材料编码, 材料名称, 数量, 批号, 仓库 FROM bl_material_out ORDER BY id DESC;
GO
-- 其他入库单结构
SELECT c.name, t.name typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('bd_other_in') ORDER BY c.column_id;
