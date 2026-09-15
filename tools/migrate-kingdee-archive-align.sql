-- migrate-kingdee-archive-align.sql — 基础档案面板/字段对齐金蝶ERP命名(金蝶云·星辰同步口径)
-- 依据:deploy/jdy-sync.zip 内 README §7 字段映射 + sync.mjs mapHead/mapPurHead/mapLines:
--   customer_number→客户编码 · supplier_number/name→供应商编码/供应商 · delivery_address→到货地址
--   contact_linkman→联系人 · material_number/name/model→存货编码/存货名称/规格型号(INV 已对齐不动)
-- 改法:仅改 yj_field.label / yj_panel.panel_name(显示层),col_name 与物理列不动——
--   参照字段(refField/displayField)存的是 col_name,后端 refLabelOf 运行时转标签,改名不破引用。
-- 幂等:UPDATE 直写(重复执行同值)、INSERT 全 IF NOT EXISTS、翻译 MERGE NOT MATCHED,可重复执行。
SET NOCOUNT ON;
GO

-- ══ 1. KHDA 客户档案:客户代码 → 客户编码(customer_number 口径) ══
UPDATE yj_field SET label = N'客户编码' WHERE panel_code = 'KHDA' AND col_name = 'dm';
GO

-- ══ 2. KHDA 补字段:联系人(contact_linkman 口径;dm_kh 加物理列 lxr) ══
IF COL_LENGTH('dbo.dm_kh', 'lxr') IS NULL ALTER TABLE dbo.dm_kh ADD [lxr] nvarchar(200) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.dm_kh') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.dm_kh'), 'lxr', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'联系人(金蝶星辰 contact_linkman 口径)', N'SCHEMA', N'dbo', N'TABLE', N'dm_kh', N'COLUMN', N'lxr';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'KHDA' AND col_name = 'lxr')
BEGIN
    UPDATE yj_field SET seq = seq + 1 WHERE panel_code = 'KHDA' AND seq >= 6;  -- 电话(5)之后插入,原 6..14 顺延
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('KHDA', N'lxr', N'联系人', N'文本', NULL, NULL, NULL, NULL, N'detail', 6, 120, 1, 0, 0, 1);
END
GO

-- ══ 3. GFDA 厂商档案 → 供应商档案(supplier 口径) ══
UPDATE yj_panel SET panel_name = N'供应商档案' WHERE panel_code = 'GFDA';
UPDATE yj_field SET label = N'供应商编码' WHERE panel_code = 'GFDA' AND col_name = 'dm';
UPDATE yj_field SET label = N'供应商名称' WHERE panel_code = 'GFDA' AND col_name = 'mc';
UPDATE yj_field SET label = N'供应商级别' WHERE panel_code = 'GFDA' AND col_name = 'csjb';
UPDATE yj_field SET label = N'到货地址'   WHERE panel_code = 'GFDA' AND col_name = 'ckadd';
GO

-- ══ 4. YWYDA 业务员档案:业务员代码/姓名 → 业务员编码/业务员名称(emp 编码/名称口径) ══
UPDATE yj_field SET label = N'业务员编码' WHERE panel_code = 'YWYDA' AND col_name = 'dm';
UPDATE yj_field SET label = N'业务员名称' WHERE panel_code = 'YWYDA' AND col_name = 'mc';
GO

-- ══ 5. CKDA 仓库档案:仓库代码 → 仓库编码(stock 编码口径) ══
UPDATE yj_field SET label = N'仓库编码' WHERE panel_code = 'CKDA' AND col_name = 'dm';
GO

-- ══ 6. 多语言译名(9 语言;客户编码/供应商编码/到货地址/仓库编码 已有全量译名,免插) ══
MERGE yj_translation AS t USING (VALUES
(N'panel', N'供应商档案', N'en', N'Supplier Archive'),
(N'panel', N'供应商档案', N'ja', N'仕入先マスター'),
(N'panel', N'供应商档案', N'ko', N'공급업체 마스터'),
(N'panel', N'供应商档案', N'de', N'Lieferantenstamm'),
(N'panel', N'供应商档案', N'es', N'Maestro de proveedores'),
(N'panel', N'供应商档案', N'fr', N'Fournisseurs'),
(N'panel', N'供应商档案', N'ru', N'Реестр поставщиков'),
(N'panel', N'供应商档案', N'th', N'ทะเบียนผู้ขาย'),
(N'panel', N'供应商档案', N'vi', N'Hồ sơ nhà cung cấp'),
(N'field', N'供应商名称', N'en', N'Supplier Name'),
(N'field', N'供应商名称', N'ja', N'仕入先名'),
(N'field', N'供应商名称', N'ko', N'공급업체명'),
(N'field', N'供应商名称', N'de', N'Lieferantenname'),
(N'field', N'供应商名称', N'es', N'Nombre de proveedor'),
(N'field', N'供应商名称', N'fr', N'Nom du fournisseur'),
(N'field', N'供应商名称', N'ru', N'Название поставщика'),
(N'field', N'供应商名称', N'th', N'ชื่อผู้ขาย'),
(N'field', N'供应商名称', N'vi', N'Tên nhà cung cấp'),
(N'field', N'供应商级别', N'en', N'Supplier Level'),
(N'field', N'供应商级别', N'ja', N'仕入先ランク'),
(N'field', N'供应商级别', N'ko', N'공급업체 등급'),
(N'field', N'供应商级别', N'de', N'Lieferantenstufe'),
(N'field', N'供应商级别', N'es', N'Nivel de proveedor'),
(N'field', N'供应商级别', N'fr', N'Niveau fournisseur'),
(N'field', N'供应商级别', N'ru', N'Категория поставщика'),
(N'field', N'供应商级别', N'th', N'ระดับผู้ขาย'),
(N'field', N'供应商级别', N'vi', N'Hạng nhà cung cấp'),
(N'field', N'业务员编码', N'en', N'Salesperson Code'),
(N'field', N'业务员编码', N'ja', N'担当者コード'),
(N'field', N'业务员编码', N'ko', N'담당자 코드'),
(N'field', N'业务员编码', N'de', N'Vertriebsmitarbeiternr.'),
(N'field', N'业务员编码', N'es', N'Código de vendedor'),
(N'field', N'业务员编码', N'fr', N'Code vendeur'),
(N'field', N'业务员编码', N'ru', N'Код менеджера'),
(N'field', N'业务员编码', N'th', N'รหัสพนักงานขาย'),
(N'field', N'业务员编码', N'vi', N'Mã nhân viên bán'),
(N'field', N'业务员名称', N'en', N'Salesperson Name'),
(N'field', N'业务员名称', N'ja', N'担当者名'),
(N'field', N'业务员名称', N'ko', N'담당자명'),
(N'field', N'业务员名称', N'de', N'Vertriebsmitarbeitername'),
(N'field', N'业务员名称', N'es', N'Nombre de vendedor'),
(N'field', N'业务员名称', N'fr', N'Nom du vendeur'),
(N'field', N'业务员名称', N'ru', N'Имя менеджера'),
(N'field', N'业务员名称', N'th', N'ชื่อพนักงานขาย'),
(N'field', N'业务员名称', N'vi', N'Tên nhân viên bán'),
(N'field', N'联系人', N'de', N'Kontakt'),
(N'field', N'联系人', N'es', N'Contacto'),
(N'field', N'联系人', N'fr', N'Contact'),
(N'field', N'联系人', N'ja', N'担当者'),
(N'field', N'联系人', N'ko', N'연락처'),
(N'field', N'联系人', N'ru', N'Контакт'),
(N'field', N'联系人', N'th', N'ผู้ติดต่อ'),
(N'field', N'联系人', N'vi', N'Liên hệ')
) AS s(scope, ref_key, locale, text)
ON t.scope = s.scope AND t.ref_key = s.ref_key AND t.locale = s.locale
WHEN NOT MATCHED THEN INSERT (scope, ref_key, locale, text, source) VALUES (s.scope, s.ref_key, s.locale, s.text, 'manual');
GO

-- 面板英文名通道回填(供应商档案)
UPDATE p SET p.panel_name_en = s.text
FROM yj_panel p JOIN yj_translation s ON s.scope = 'panel' AND s.ref_key = p.panel_name AND s.locale = 'en'
WHERE p.panel_code = 'GFDA' AND (p.panel_name_en IS NULL OR p.panel_name_en = N'');
GO

-- ══ 7. 自检:改名后各面板首字段 + 新字段 + 翻译覆盖 ══
SELECT N'KHDA.dm=' + label + N' / 联系人列=' + CASE WHEN COL_LENGTH('dbo.dm_kh','lxr') IS NULL THEN N'缺' ELSE N'有' END FROM yj_field WHERE panel_code='KHDA' AND col_name='dm';
SELECT N'GFDA 面板=' + panel_name FROM yj_panel WHERE panel_code='GFDA';
SELECT f.col_name + N'=' + f.label FROM yj_field f WHERE f.panel_code='GFDA' AND f.col_name IN ('dm','mc','csjb','ckadd') ORDER BY f.seq;
SELECT f.col_name + N'=' + f.label FROM yj_field f WHERE f.panel_code='YWYDA' AND f.col_name IN ('dm','mc') ORDER BY f.seq;
SELECT N'CKDA.dm=' + f.label FROM yj_field f WHERE f.panel_code='CKDA' AND f.col_name='dm';
SELECT s.scope + N':' + s.ref_key + N' 译名缺=' + CAST(s.expected - ISNULL(t.n,0) AS nvarchar(2)) + N' (期望0)'
FROM (VALUES (N'供应商档案',N'panel',9),(N'供应商名称',N'field',9),(N'供应商级别',N'field',9),(N'业务员编码',N'field',9),(N'业务员名称',N'field',9),(N'联系人',N'field',9),(N'客户编码',N'field',9),(N'供应商编码',N'field',9),(N'到货地址',N'field',9),(N'仓库编码',N'field',9)) AS s(ref_key,scope,expected)
LEFT JOIN (SELECT ref_key, scope, COUNT(*) n FROM yj_translation WHERE locale IN ('en','ja','ko','de','es','fr','ru','th','vi') GROUP BY ref_key, scope) t ON t.ref_key=s.ref_key AND t.scope=s.scope;
PRINT N'migrate-kingdee-archive-align 完成(基础档案已对齐金蝶命名)';
GO
