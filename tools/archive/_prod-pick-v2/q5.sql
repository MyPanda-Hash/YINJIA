SET NOCOUNT ON;
SELECT id, 单据编号, 产品编号, 产品名称, 配料要求, 表区, 工艺形态, ISNULL(asp_cancel,'') c FROM rd_mold_proc_head;
GO
SELECT id, 单据编号, 表区, 序号, 物料种类, 物料编号, 物料名称, 实际添加比例, 单支物料含量, 设计添加量 FROM rd_mold_proc_detail;
GO
SELECT TOP 3 * FROM plang;
