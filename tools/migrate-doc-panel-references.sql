-- migrate-doc-panel-references.sql — 四单据对基础资料的参照设计
-- 设计:
--   存货/物料 → INV(商品), 供应商 → GFDA, 客户 → KHDA, 仓库 → WH
--   ref_field=匹配列(编码), display_field=选中后回填显示列(名称)
--   同时给 KHDA/GFDA/WH 补 query 位(参照弹窗搜索列)
SET NOCOUNT ON;

-- ══ 0) 档案面板补 query 位(参照弹窗搜索用) ══
-- KHDA(客户):dm=客户编码, mc=客户名称
UPDATE yj_field SET place = 'query,' + place WHERE panel_code='KHDA' AND col_name='dm' AND place NOT LIKE '%query%';
UPDATE yj_field SET place = 'query,' + place WHERE panel_code='KHDA' AND col_name='mc' AND place NOT LIKE '%query%';
-- GFDA(供应商):dm=供应商编码, mc=供应商名称
UPDATE yj_field SET place = 'query,' + place WHERE panel_code='GFDA' AND col_name='dm' AND place NOT LIKE '%query%';
UPDATE yj_field SET place = 'query,' + place WHERE panel_code='GFDA' AND col_name='mc' AND place NOT LIKE '%query%';
-- WH(仓库):仓库编码, 仓库名称
UPDATE yj_field SET place = 'query,' + place WHERE panel_code='WH' AND col_name=N'仓库编码' AND place NOT LIKE '%query%';
UPDATE yj_field SET place = 'query,' + place WHERE panel_code='WH' AND col_name=N'仓库名称' AND place NOT LIKE '%query%';

-- ══ 1) PURCHASE_IN(采购入库) ══
-- 存货编码 → INV.存货编码(显示存货名称)
UPDATE yj_field SET ref_panel='INV', ref_field=N'存货编码', display_field=N'存货名称'
WHERE panel_code='PURCHASE_IN' AND col_name=N'存货编码';
-- 存货名称 → INV.存货名称
UPDATE yj_field SET ref_panel='INV', ref_field=N'存货名称', display_field=N'存货名称'
WHERE panel_code='PURCHASE_IN' AND col_name=N'存货名称';
-- 供应商 → GFDA.dm(显示mc)
UPDATE yj_field SET ref_panel='GFDA', ref_field='dm', display_field='mc'
WHERE panel_code='PURCHASE_IN' AND col_name=N'供应商';
-- 仓库 → WH.仓库编码(显示仓库名称)
UPDATE yj_field SET ref_panel='WH', ref_field=N'仓库编码', display_field=N'仓库名称'
WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库' AND place LIKE '%header%';
-- 仓库名称(行) → WH.仓库名称
UPDATE yj_field SET ref_panel='WH', ref_field=N'仓库名称', display_field=N'仓库名称'
WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库名称' AND place='detail';

-- ══ 2) SALE_OUT(销售出库) ══
UPDATE yj_field SET ref_panel='INV', ref_field=N'存货编码', display_field=N'存货名称'
WHERE panel_code='SALE_OUT' AND col_name=N'存货编码';
UPDATE yj_field SET ref_panel='INV', ref_field=N'存货名称', display_field=N'存货名称'
WHERE panel_code='SALE_OUT' AND col_name=N'存货名称';
UPDATE yj_field SET ref_panel='KHDA', ref_field='dm', display_field='mc'
WHERE panel_code='SALE_OUT' AND col_name=N'客户';
UPDATE yj_field SET ref_panel='WH', ref_field=N'仓库编码', display_field=N'仓库名称'
WHERE panel_code='SALE_OUT' AND col_name=N'仓库' AND place LIKE '%header%';
UPDATE yj_field SET ref_panel='WH', ref_field=N'仓库名称', display_field=N'仓库名称'
WHERE panel_code='SALE_OUT' AND col_name=N'仓库名称' AND place='detail';

-- ══ 3) SO_ORDER(销售订单)修正:客户 从 PARTNER 改为 KHDA ══
UPDATE yj_field SET ref_panel='KHDA', ref_field='dm', display_field='mc'
WHERE panel_code='SO_ORDER' AND col_name=N'客户';
-- 结算客户 → KHDA.mc
UPDATE yj_field SET ref_panel='KHDA', ref_field='mc', display_field='mc'
WHERE panel_code='SO_ORDER' AND col_name=N'结算客户' AND ISNULL(ref_panel,'')='';
-- 业务员 → EMP
UPDATE yj_field SET ref_panel='EMP', ref_field=N'员工名称', display_field=N'员工名称'
WHERE panel_code='SO_ORDER' AND col_name=N'业务员' AND ISNULL(ref_panel,'')='';

-- ══ 4) PU_ORDER(采购订单)修正:供应商 从 PARTNER 改为 GFDA ══
UPDATE yj_field SET ref_panel='GFDA', ref_field='dm', display_field='mc'
WHERE panel_code='PU_ORDER' AND col_name=N'供应商';
-- 经手人 → EMP
UPDATE yj_field SET ref_panel='EMP', ref_field=N'员工名称', display_field=N'员工名称'
WHERE panel_code='PURCHASE_IN' AND col_name=N'经手人' AND ISNULL(ref_panel,'')='';
UPDATE yj_field SET ref_panel='EMP', ref_field=N'员工名称', display_field=N'员工名称'
WHERE panel_code='SALE_OUT' AND col_name=N'经手人' AND ISNULL(ref_panel,'')='';

GO
-- 自检
SELECT panel_code, col_name, ref_panel, ref_field, display_field
FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER','PU_ORDER') AND ISNULL(ref_panel,'')<>''
ORDER BY panel_code, seq;
GO
PRINT N'四单据参照设计完成';
GO
