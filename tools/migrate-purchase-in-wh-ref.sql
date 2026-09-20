-- migrate-purchase-in-wh-ref.sql — 采购入库单"仓库名称"启用仓库参照选择
-- 2026-09-17 用户需求:仓库名称能点选仓库档案(WH),方式同供应商选择。
--   现状:仓库名称字段已配 ref_panel=WH/ref_field=仓库名称,但 data_type='文本'——
--   配置序列化只对"参照"型输出 ref,前端不弹选择。改 data_type='参照'即点选;
--   同名自动映射同时带出隐藏的"仓库编码"列(编码存值供流转),必填已置。
-- 幂等可重跑。
SET NOCOUNT ON;
GO
UPDATE yj_field SET data_type = N'参照'
WHERE panel_code = 'PURCHASE_IN' AND label = N'仓库名称' AND place LIKE '%detail%'
  AND data_type <> N'参照';
GO
-- 自检
SELECT label, data_type, ref_panel, ref_field, display_field, required FROM yj_field
WHERE panel_code = 'PURCHASE_IN' AND label = N'仓库名称';
GO
PRINT N'migrate-purchase-in-wh-ref 完成';
GO
