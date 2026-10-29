/* ============================================================================
 * i18n-supplier-portal-20261024.sql —— 供应商门户(2026-10-24)面板名译名
 * ----------------------------------------------------------------------------
 * 《多语言强制规范》(AGENTS.md)要求:新增面板必须同时交付译名,否则视为功能未完成。
 * 本轮新增两个**页面级虚拟面板**(不在 yj_panel 里,定义见后端 PagePanelRegistry):
 *   SUPPLIER_PRINT   供应商采购打印    ← 供应商账号登录后唯一能看到的页面
 *   SUPPLIER_ACCOUNT 供应商权限配置    ← 采购管理下维护供应商登录账号(管理员专属)
 * 以及它们所在的分组节点「供应商门户」(菜单标题,前端 tt() 直接查 biz 词典,
 * 这里一并入表,让 /api/locale/dict 也能命中)。
 *
 * 写法与 tools/i18n-*.sql 同口径:scope='panel'、ref_key=中文原文、source='manual',
 * **已存在即跳过**(不覆盖人工校对过的译名);幂等可重跑。
 * 语言:与「采购订单」等既有面板译名同一批 9 种(en/ja/ko/de/es/fr/ru/vi/th),
 * zh-CN 为源语言不需要译名,zh-TW 由前端语言包提供。
 * ========================================================================== */

SET NOCOUNT ON;
GO

DECLARE @t TABLE (ref_key nvarchar(200) NOT NULL, locale nvarchar(10) NOT NULL, text nvarchar(500) NOT NULL);

INSERT INTO @t (ref_key, locale, text) VALUES
 -- 面板:供应商采购打印
 (N'供应商采购打印', 'en', N'Supplier Purchase Print'),
 (N'供应商采购打印', 'ja', N'仕入先購買印刷'),
 (N'供应商采购打印', 'ko', N'공급업체 구매 인쇄'),
 (N'供应商采购打印', 'de', N'Lieferanten-Einkaufsdruck'),
 (N'供应商采购打印', 'es', N'Impresión de compras de proveedores'),
 (N'供应商采购打印', 'fr', N'Impression achats fournisseurs'),
 (N'供应商采购打印', 'ru', N'Печать закупок поставщика'),
 (N'供应商采购打印', 'vi', N'In phiếu mua hàng nhà cung cấp'),
 (N'供应商采购打印', 'th', N'พิมพ์ใบสั่งซื้อของผู้จัดจำหน่าย'),
 -- 面板:供应商权限配置
 (N'供应商权限配置', 'en', N'Supplier Permission Setup'),
 (N'供应商权限配置', 'ja', N'仕入先権限設定'),
 (N'供应商权限配置', 'ko', N'공급업체 권한 설정'),
 (N'供应商权限配置', 'de', N'Lieferantenberechtigungen'),
 (N'供应商权限配置', 'es', N'Permisos de proveedores'),
 (N'供应商权限配置', 'fr', N'Droits fournisseurs'),
 (N'供应商权限配置', 'ru', N'Права поставщиков'),
 (N'供应商权限配置', 'vi', N'Cấu hình quyền nhà cung cấp'),
 (N'供应商权限配置', 'th', N'ตั้งค่าสิทธิ์ผู้จัดจำหน่าย'),
 -- 菜单分组:供应商门户
 (N'供应商门户', 'en', N'Supplier Portal'),
 (N'供应商门户', 'ja', N'仕入先ポータル'),
 (N'供应商门户', 'ko', N'공급업체 포털'),
 (N'供应商门户', 'de', N'Lieferantenportal'),
 (N'供应商门户', 'es', N'Portal de proveedores'),
 (N'供应商门户', 'fr', N'Portail fournisseurs'),
 (N'供应商门户', 'ru', N'Портал поставщиков'),
 (N'供应商门户', 'vi', N'Cổng nhà cung cấp'),
 (N'供应商门户', 'th', N'พอร์ทัลผู้จัดจำหน่าย'),
 -- 权限矩阵里用到的动作标签(「打印」「可见」等早已在册,这里只补本轮独有的)
 (N'仅管理员', 'en', N'Administrators only'),
 (N'仅管理员', 'ja', N'管理者のみ'),
 (N'仅管理员', 'ko', N'관리자 전용'),
 (N'仅管理员', 'de', N'Nur Administratoren'),
 (N'仅管理员', 'es', N'Solo administradores'),
 (N'仅管理员', 'fr', N'Administrateurs uniquement'),
 (N'仅管理员', 'ru', N'Только администратор'),
 (N'仅管理员', 'vi', N'Chỉ quản trị viên'),
 (N'仅管理员', 'th', N'เฉพาะผู้ดูแลระบบ');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'panel', t.ref_key, t.locale, t.text, N'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = N'panel' AND x.ref_key = t.ref_key AND x.locale = t.locale);
PRINT N'供应商门户面板译名已写入(已存在的不覆盖)';
GO

/* ---------- 自检:三个键、九种语言,逐键数量必须为 9 ---------- */
DECLARE @bad nvarchar(400) = N'';
SELECT @bad = @bad + ref_key + N'(' + CAST(c AS varchar) + N')'
  FROM (SELECT ref_key, COUNT(*) AS c FROM yj_translation
         WHERE scope = N'panel' AND source = N'manual'
           AND ref_key IN (N'供应商采购打印', N'供应商权限配置', N'供应商门户', N'仅管理员')
         GROUP BY ref_key) t
 WHERE c < 9;
IF @bad <> N'' RAISERROR(N'自检失败:以下面板译名语言数不足 9(应含 en/ja/ko/de/es/fr/ru/vi/th): %s', 16, 1, @bad);

SELECT ref_key AS 面板, COUNT(*) AS 语言数,
       MAX(CASE WHEN locale = 'en' THEN text END) AS 英文
  FROM yj_translation
 WHERE scope = N'panel' AND ref_key IN (N'供应商采购打印', N'供应商权限配置', N'供应商门户', N'仅管理员')
 GROUP BY ref_key;
GO
PRINT N'✅ 供应商门户译名就绪';
GO
