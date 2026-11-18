SET NOCOUNT ON;
PRINT '== 正式库 烧结工艺清单 表头 ==';
SELECT 单据编号, 产品编号, 产品名称, 版本号 FROM dbo.rd_mold_proc_head WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
PRINT '== 正式库 X烧结 表头 ==';
SELECT 单据编号, 产品编号, 产品名称, 版本号 FROM dbo.rd_x_sinter_head WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
PRINT '== 正式库 rd_mold_proc_detail 样本(配方表) ==';
SELECT TOP 20 d.单据编号, d.序号, d.物料种类, d.物料编号, d.物料名称, d.实际添加比例, d.单支物料含量, d.设计添加量
  FROM dbo.rd_mold_proc_detail d WHERE d.表区=N'配方表' AND ISNULL(d.asp_cancel,'N')<>'Y' ORDER BY d.id DESC;
PRINT '== 上述物料的存货单位 ==';
SELECT TOP 20 i.存货编码, i.存货名称, i.计量单位 FROM dbo.bs_inv i WHERE i.存货编码 IN (SELECT TOP 20 物料编号 FROM dbo.rd_mold_proc_detail WHERE 表区=N'配方表' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC);
