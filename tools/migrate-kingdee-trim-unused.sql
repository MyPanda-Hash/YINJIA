-- migrate-kingdee-trim-unused.sql — 面板字段按金蝶实际使用裁剪(隐藏,不删列不删数据,随时可恢复)
-- 口径(用户确认):按 sync-core.mjs 实际映射「有值写入」的字段集对齐;金蝶不回填(映射写 null)或
--               金蝶档案无此字段的 MES 富余字段 → hidden=1(出表单)+visible=0(出列表列);
--               挂查询位的同步剥掉 query(出查询栏)。保留列与数据,业务代码/同步写库不受影响。
-- 订单(sync 映射 null):
--   SO头: 部门负责人 项目 | SO行: 品牌 | PU头: 项目 到货地址 发货状态 合同号 订金金额 付款方式 | PU行: 现存量说明
-- 档案(金蝶档案无此字段/同步不写):
--   KHDA: 法人代表 注册资本 成立日期 | GFDA: 供应商级别 到货地址 | INV: 参考成本 最新成本
--   EMP : 业务员 证件类型 职务 职称 | DEPT: 部门类型 电话 | WH: 允许零库存出库 仓库类型 所属车间
--   UOM : 单位类型 主单位 换算率
-- 幂等:UPDATE 直写同值,可重复执行。
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ══ 1. 订单面板 ══
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'SO_ORDER' AND col_name = N'部门负责人';
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'SO_ORDER' AND col_name = N'项目';
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'SO_ORDER' AND col_name = N'品牌';
UPDATE yj_field SET hidden = 1, visible = 0, place = N'header' WHERE panel_code = 'PU_ORDER' AND col_name = N'项目' AND place LIKE '%query%';
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'PU_ORDER' AND col_name = N'项目' AND (place IS NULL OR place NOT LIKE '%query%');
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'PU_ORDER' AND col_name IN (N'到货地址', N'发货状态', N'合同号', N'订金金额', N'付款方式');
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'PU_ORDER' AND col_name = N'现存量说明' AND place = N'detail';
GO

-- ══ 2. 基础档案面板 ══
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'KHDA' AND col_name IN (N'frdb', N'zczb', N'clrq');
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'GFDA' AND col_name IN (N'csjb', N'ckadd');
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'INV'  AND col_name IN (N'参考成本', N'最新成本');
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'EMP'  AND col_name IN (N'业务员', N'证件类型', N'职务', N'职称');
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'DEPT' AND col_name IN (N'部门类型', N'电话');
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'WH'   AND col_name IN (N'允许零库存出库', N'仓库类型', N'所属车间');
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'UOM'  AND col_name IN (N'单位类型', N'主单位', N'换算率');
GO

-- ══ 3. 自检(被隐藏字段清单 + 各面板仍可见字段数) ══
SELECT panel_code, col_name, label FROM yj_field
WHERE (panel_code IN ('SO_ORDER','PU_ORDER','KHDA','GFDA','INV','EMP','DEPT','WH','UOM')
       AND hidden = 1 AND visible = 0)
ORDER BY panel_code, place, seq;
SELECT panel_code, COUNT(*) AS 可见字段数 FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','KHDA','GFDA','INV','EMP','DEPT','WH','UOM')
  AND ISNULL(hidden,0) = 0 AND ISNULL(visible,1) = 1
GROUP BY panel_code ORDER BY panel_code;
PRINT N'migrate-kingdee-trim-unused 完成(金蝶实际使用口径裁剪)';
GO
