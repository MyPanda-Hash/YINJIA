-- migrate-kingdee-archive-align3.sql — 基础档案面板中文名对齐金蝶面板命名(第三期)
-- 依据:deploy/面板字段对照.md §一 金蝶 12 基础资料面板名(客户/供应商/商品(存货)/职员/部门/仓库/计量单位/
--       结算方式/客户分类/供应商分类/商品分类/币别)。"命名以金蝶的为准":4 个已有面板改名,其余 8 个已一致。
-- 改动(仅显示层 panel_name/panel_name_en + panel 域译名;panel_code/表/字段键全不动,引用零影响):
--   KHDA 客户档案 → 客户(customer)          GFDA 供应商档案 → 供应商(supplier)
--   INV  存货     → 商品(material_detail)   EMP  员工     → 职员(emp_detail)
-- 幂等:UPDATE 直写同值 / MERGE NOT MATCHED,可重复执行。
SET NOCOUNT ON;
GO

-- ══ 1. 面板改名(中文对齐金蝶 + 英文名同步) ══
UPDATE yj_panel SET panel_name = N'客户', panel_name_en = N'Customer' WHERE panel_code = 'KHDA';
UPDATE yj_panel SET panel_name = N'供应商', panel_name_en = N'Supplier' WHERE panel_code = 'GFDA';
UPDATE yj_panel SET panel_name = N'商品', panel_name_en = N'Material' WHERE panel_code = 'INV';
UPDATE yj_panel SET panel_name = N'职员', panel_name_en = N'Employee' WHERE panel_code = 'EMP';
UPDATE yj_panel SET panel_name_en = N'Department' WHERE panel_code = 'DEPT' AND (panel_name_en IS NULL OR panel_name_en = N'');
UPDATE yj_panel SET panel_name_en = N'Warehouse' WHERE panel_code = 'WH' AND (panel_name_en IS NULL OR panel_name_en = N'');
UPDATE yj_panel SET panel_name_en = N'UOM' WHERE panel_code = 'UOM' AND (panel_name_en IS NULL OR panel_name_en = N'');
GO

-- ══ 2. 面板名译名(panel 域,9 语言;字段域已有 客户/供应商 沿用,商品/职员 全新) ══
MERGE yj_translation AS t USING (VALUES
(N'panel', N'客户', N'en', N'Customer'),
(N'panel', N'客户', N'ja', N'顧客'),
(N'panel', N'客户', N'ko', N'고객'),
(N'panel', N'客户', N'de', N'Kunde'),
(N'panel', N'客户', N'es', N'Cliente'),
(N'panel', N'客户', N'fr', N'Client'),
(N'panel', N'客户', N'ru', N'Клиент'),
(N'panel', N'客户', N'th', N'ลูกค้า'),
(N'panel', N'客户', N'vi', N'Khách hàng'),
(N'panel', N'供应商', N'en', N'Supplier'),
(N'panel', N'供应商', N'ja', N'仕入先'),
(N'panel', N'供应商', N'ko', N'공급업체'),
(N'panel', N'供应商', N'de', N'Lieferant'),
(N'panel', N'供应商', N'es', N'Proveedor'),
(N'panel', N'供应商', N'fr', N'Fournisseur'),
(N'panel', N'供应商', N'ru', N'Поставщик'),
(N'panel', N'供应商', N'th', N'ผู้ขาย'),
(N'panel', N'供应商', N'vi', N'Nhà cung cấp'),
(N'panel', N'商品', N'en', N'Material'),
(N'panel', N'商品', N'ja', N'商品'),
(N'panel', N'商品', N'ko', N'상품'),
(N'panel', N'商品', N'de', N'Ware'),
(N'panel', N'商品', N'es', N'Artículo'),
(N'panel', N'商品', N'fr', N'Article'),
(N'panel', N'商品', N'ru', N'Товар'),
(N'panel', N'商品', N'th', N'สินค้า'),
(N'panel', N'商品', N'vi', N'Hàng hóa'),
(N'panel', N'职员', N'en', N'Employee'),
(N'panel', N'职员', N'ja', N'職員'),
(N'panel', N'职员', N'ko', N'직원'),
(N'panel', N'职员', N'de', N'Mitarbeiter'),
(N'panel', N'职员', N'es', N'Empleado'),
(N'panel', N'职员', N'fr', N'Employé'),
(N'panel', N'职员', N'ru', N'Сотрудник'),
(N'panel', N'职员', N'th', N'พนักงาน'),
(N'panel', N'职员', N'vi', N'Nhân viên'),
(N'panel', N'部门', N'en', N'Department'),
(N'panel', N'部门', N'ja', N'部門'),
(N'panel', N'部门', N'ko', N'부서'),
(N'panel', N'部门', N'de', N'Abteilung'),
(N'panel', N'部门', N'es', N'Departamento'),
(N'panel', N'部门', N'fr', N'Département'),
(N'panel', N'部门', N'ru', N'Отдел'),
(N'panel', N'部门', N'th', N'แผนก'),
(N'panel', N'部门', N'vi', N'Phòng ban'),
(N'panel', N'仓库', N'en', N'Warehouse'),
(N'panel', N'仓库', N'ja', N'倉庫'),
(N'panel', N'仓库', N'ko', N'창고'),
(N'panel', N'仓库', N'de', N'Lager'),
(N'panel', N'仓库', N'es', N'Almacén'),
(N'panel', N'仓库', N'fr', N'Entrepôt'),
(N'panel', N'仓库', N'ru', N'Склад'),
(N'panel', N'仓库', N'th', N'คลังสินค้า'),
(N'panel', N'仓库', N'vi', N'Kho'),
(N'panel', N'计量单位', N'en', N'UOM'),
(N'panel', N'计量单位', N'ja', N'単位'),
(N'panel', N'计量单位', N'ko', N'단위'),
(N'panel', N'计量单位', N'de', N'Maßeinheit'),
(N'panel', N'计量单位', N'es', N'Unidad de medida'),
(N'panel', N'计量单位', N'fr', N'Unité de mesure'),
(N'panel', N'计量单位', N'ru', N'Единица измерения'),
(N'panel', N'计量单位', N'th', N'หน่วยวัด'),
(N'panel', N'计量单位', N'vi', N'Đơn vị tính')
) AS s(scope, ref_key, locale, text)
ON t.scope = s.scope AND t.ref_key = s.ref_key AND t.locale = s.locale
WHEN NOT MATCHED THEN INSERT (scope, ref_key, locale, text, source) VALUES (s.scope, s.ref_key, s.locale, s.text, 'manual');
GO

-- ══ 3. 自检 ══
SELECT panel_code + N': ' + panel_name + N' / ' + ISNULL(panel_name_en, N'(无英文名)') AS 改名结果
FROM yj_panel WHERE panel_code IN ('KHDA','GFDA','INV','EMP') ORDER BY panel_code;
SELECT s.ref_key + N'(panel)' AS 译名键, s.expected - ISNULL(t.n,0) AS 缺口 FROM (VALUES
(N'客户',9),(N'供应商',9),(N'商品',9),(N'职员',9),(N'部门',9),(N'仓库',9),(N'计量单位',9)) AS s(ref_key, expected)
LEFT JOIN (SELECT ref_key, COUNT(*) n FROM yj_translation WHERE scope='panel' AND locale IN
('en','ja','ko','de','es','fr','ru','th','vi') AND ref_key IN (N'客户',N'供应商',N'商品',N'职员',N'部门',N'仓库',N'计量单位') GROUP BY ref_key) t
ON t.ref_key = s.ref_key;
PRINT N'migrate-kingdee-archive-align3 完成(4 面板中文名对齐金蝶)';
GO
