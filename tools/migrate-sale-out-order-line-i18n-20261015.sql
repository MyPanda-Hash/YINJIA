-- migrate-sale-out-order-line-i18n-20261015.sql
-- 「销售订单行号」补齐多语言(AGENTS.md 强制:新增字段标签必须同时交付译名,至少 en;
--   鼓励全语言 —— 同族的「销售订单号」已有 9 语言,本标签补齐与之对齐)。
-- 背景:migrate-sale-out-order-cols-20261015.sql 只补了 en(满足下限);
--   本次把其余 8 个语言一次补齐(与「销售订单号」同批语言集:de/en/es/fr/ja/ko/ru/th/vi)。
-- 幂等:逐行 NOT EXISTS;两账套均执行(先 HSDZ_MES 正式,后 HSDZ_MES_TEST 测试)。
SET NOCOUNT ON;
GO

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT v.scope, v.ref_key, v.locale, v.text, v.source
FROM (VALUES
  (N'field', N'销售订单行号', N'en', N'Sales Order Line No.', N'manual'),
  (N'field', N'销售订单行号', N'ja', N'販売注文行番号',       N'manual'),
  (N'field', N'销售订单行号', N'ko', N'판매 주문 라인 번호',   N'manual'),
  (N'field', N'销售订单行号', N'es', N'Número de línea del pedido de venta', N'manual'),
  (N'field', N'销售订单行号', N'fr', N'Numéro de ligne de commande de vente', N'manual'),
  (N'field', N'销售订单行号', N'de', N'Verkaufsauftragspositionsnummer', N'manual'),
  (N'field', N'销售订单行号', N'ru', N'Номер строки заказа на продажу', N'manual'),
  (N'field', N'销售订单行号', N'vi', N'Số dòng đơn hàng bán hàng', N'manual'),
  (N'field', N'销售订单行号', N'th', N'หมายเลขบรรทัดใบสั่งขาย', N'manual')
) AS v(scope, ref_key, locale, text, source)
WHERE NOT EXISTS (
  SELECT 1 FROM yj_translation t
  WHERE t.scope = v.scope AND t.ref_key = v.ref_key AND t.locale = v.locale
);
PRINT N'[OK] 「销售订单行号」译名补齐,新增 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 条';
GO

-- 自检:该标签必须有 9 个语言(de/en/es/fr/ja/ko/ru/th/vi)
DECLARE @n int = (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'销售订单行号');
IF @n >= 9
  RAISERROR(N'SELFCHECK OK  「销售订单行号」译名 %d 条(≥9 语言)', 10, 1, @n) WITH NOWAIT;
ELSE
  RAISERROR(N'SELFCHECK FAIL 「销售订单行号」译名只有 %d 条(<9)', 16, 1, @n);
GO

PRINT N'migrate-sale-out-order-line-i18n-20261015 完成';
GO
