-- 按业务使用频率为 14 个面板设置默认显隐:
--   常用=显示(visible=1,hidden=0), 不常用=隐藏(visible=0,hidden=1)
--   只动「全并集补齐」的 seq>=900 的字段(原有手工字段不动——它们已经在之前按金蝶实际使用口径裁剪过了)
SET NOCOUNT ON;

-- ══════════ 销售订单 SO_ORDER:表头(header) ══════════
-- 保留(常用):原有的 12 个业务字段(单据编号/日期/客户/编码/结算客户/币种/汇率/部门/业务员/结算期限/联系人/备注)不动
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'SO_ORDER' AND place LIKE '%header%' AND seq >= 950
  AND col_name NOT IN (N'应收金额', N'创建时间', N'创建人名称', N'出入库状态', N'客户联系电话', N'联系地址', N'发货地址', N'发货人', N'发货联系电话', N'交货方式', N'到期日', N'结算状态');

-- ══════════ 销售订单 SO_ORDER:明细行(detail) ══════════
-- 保留(常用):原有的 14 个行字段 + 行级新增中的 仓库编码/仓库名称/批号/条形码/基本单位名称/辅助数量/源单编号/源单类型名称
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'SO_ORDER' AND place = 'detail' AND seq >= 960
  AND col_name NOT IN (N'仓库名称', N'仓库编码', N'批号', N'条形码', N'基本单位名称', N'辅助数量', N'源单编号', N'源单类型名称');

-- ══════════ 采购订单 PU_ORDER:表头 ══════════
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'PU_ORDER' AND place LIKE '%header%' AND seq >= 950
  AND col_name NOT IN (N'应付金额', N'创建时间', N'创建人名称', N'出入库状态', N'交货方式', N'到期日', N'结算状态');

-- ══════════ 采购订单 PU_ORDER:明细行 ══════════
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'PU_ORDER' AND place = 'detail' AND seq >= 960
  AND col_name NOT IN (N'仓库名称', N'仓库编码', N'批号', N'条形码', N'基本单位名称', N'辅助数量', N'源单编号', N'源单类型名称', N'供应商商品编码');

-- ══════════ 客户 KHDA ══════════
-- 原有 40 个字段全部保留(已按金蝶实际使用口径裁剪过);新增的联系人地区 id/编码 隐藏,名称保留
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'KHDA' AND seq >= 960
  AND col_name NOT IN (N'联系人国家名称', N'联系人省份名称', N'联系人市区名称', N'联系人区县名称');

-- ══════════ 供应商 GFDA ══════════
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'GFDA' AND seq >= 960
  AND col_name NOT IN (N'供应商联系人国家名称', N'供应商联系人省份名称', N'供应商联系人市区名称', N'供应商联系人区县名称');

-- ══════════ 商品 INV ══════════
-- 原有 75 个已按金蝶口径裁剪;新增的 id/编码类隐藏,业务名称保留
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'INV' AND seq >= 950
  AND col_name NOT IN (N'默认仓库名称', N'基本单位编码', N'商品标签', N'多单位');

-- ══════════ 其余档案(仓库/部门/职员/计量单位/币别/分类/结算方式) ══════════
-- 新增的全是 id/创建修改人/长编码类,全隐藏
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code IN ('WH','DEPT','EMP','UOM','CUR','SETTLE','CUSGRP','SUPGRP','MATGRP') AND seq >= 950;

-- ══════════ 自检 ══════════
SELECT panel_code,
  COUNT(*) AS 总字段,
  SUM(CASE WHEN ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1 THEN 1 ELSE 0 END) AS 显示,
  SUM(CASE WHEN ISNULL(hidden,0)=1 OR ISNULL(visible,1)=0 THEN 1 ELSE 0 END) AS 隐藏
FROM yj_field
WHERE panel_code IN ('KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR','SO_ORDER','PU_ORDER')
GROUP BY panel_code ORDER BY panel_code;
GO
PRINT N'面板默认显隐设置完成';
GO
