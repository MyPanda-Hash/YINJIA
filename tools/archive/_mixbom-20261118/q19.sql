SELECT 单据编号, 表区, 序号, 物料种类, 物料编号, 物料名称, 实际添加比例, 单支物料含量, 设计添加量, asp_cancel FROM rd_mold_proc_detail WHERE 表区=N'配方表' ORDER BY 单据编号, TRY_CAST(序号 AS int), id;
SELECT 单据编号, 产品编号, 产品名称, 版本号 FROM rd_mold_proc_head ORDER BY 单据编号;
SELECT COUNT(*) xs FROM rd_x_sinter_detail;
