-- migrate-redesign-inbound-outbound-detail.sql — 采购入库/销售出库明细行重设计(对齐 SO/PU 风格)
-- 核心(编码/名称/规格/数量/单位/单价/税率/金额)+ 入库出库必须(批号/仓库/现存量/备注)
SET NOCOUNT ON;

-- ══ PURCHASE_IN 明细行 ══
UPDATE yj_field SET hidden=1, visible=0 WHERE panel_code='PURCHASE_IN' AND place='detail';
UPDATE yj_field SET hidden=0, visible=1 WHERE panel_code='PURCHASE_IN' AND place='detail' AND col_name IN (
  -- 核心(与 PU_ORDER 一致)
  N'存货编码', N'存货名称', N'规格型号',
  N'实收数量', N'计量单位',                                   -- 入库数量=实收
  N'单价', N'税率%', N'含税单价', N'金额', N'含税金额',
  -- 入库必须
  N'批号', N'仓库名称', N'现存量', N'备注',
  -- 辅助数量(与 PU 的 数量2/计量单位2 对应)
  N'实收数量2', N'计量单位2', N'基本单位名称'
);

-- ══ SALE_OUT 明细行 ══
UPDATE yj_field SET hidden=1, visible=0 WHERE panel_code='SALE_OUT' AND place='detail';
UPDATE yj_field SET hidden=0, visible=1 WHERE panel_code='SALE_OUT' AND place='detail' AND col_name IN (
  -- 核心(与 SO_ORDER 一致)
  N'存货编码', N'存货名称', N'规格型号',
  N'数量', N'计量单位',                                       -- 出库数量
  N'单价', N'税率%', N'含税单价', N'金额', N'含税金额',
  -- 出库必须
  N'批号', N'仓库名称', N'现存量', N'备注',
  -- 出库特有
  N'退货数量', N'基本单位名称'
);

-- ══ SO_ORDER 明细也顺便精简(之前测试脚本开太多了) ══
UPDATE yj_field SET hidden=1, visible=0 WHERE panel_code='SO_ORDER' AND place='detail';
UPDATE yj_field SET hidden=0, visible=1 WHERE panel_code='SO_ORDER' AND place='detail' AND col_name IN (
  N'存货编码', N'存货名称', N'规格型号', N'数量', N'销售单位',
  N'单价', N'税率%', N'含税单价', N'金额', N'含税金额',
  N'折扣金额', N'现存量', N'备注'
);

-- ══ PU_ORDER 明细精简到核心 ══
UPDATE yj_field SET hidden=1, visible=0 WHERE panel_code='PU_ORDER' AND place='detail';
UPDATE yj_field SET hidden=0, visible=1 WHERE panel_code='PU_ORDER' AND place='detail' AND col_name IN (
  N'物料编码', N'物料名称', N'规格型号', N'数量', N'单位',
  N'单价', N'税率%', N'含税单价', N'金额', N'含税金额',
  N'数量2', N'计量单位2', N'仓库', N'预计到货日期', N'现存量', N'折扣%', N'折扣金额'
);

GO
SELECT panel_code, place,
  SUM(CASE WHEN ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1 THEN 1 ELSE 0 END) AS 显示
FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER','PU_ORDER')
  AND ((panel_code IN ('PURCHASE_IN','SALE_OUT') AND place='detail') OR (panel_code IN ('SO_ORDER','PU_ORDER') AND place='detail'))
GROUP BY panel_code, place;
GO
PRINT N'明细行重设计完成';
GO
