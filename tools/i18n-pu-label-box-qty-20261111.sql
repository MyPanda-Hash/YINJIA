/* ============================================================================
 * i18n-pu-label-box-qty-20261111.sql —— 「打印材料码」每箱数量相关词条(2026-11-11)
 * ----------------------------------------------------------------------------
 * 背景:同一需求给材料码打印弹窗加了「每箱数量」列,卡面「数量」改印每箱数量,
 *   并给出整箱/零头箱提示。新增**显示层**词条(scope='field',与「选择日期」等按钮/占位词同口径):
 *     每箱数量 / 每箱 / 整箱 / 零头箱 / 不足每箱
 *   长句提示(带数字拼接的那几条)只进前端静态包 src/i18n/locales 下的各语言 js,不入本表。
 *
 * 幂等:逐(词条 × 语言)判重,**已存在即跳过**,不覆盖人工校对。
 * 前端静态包同步加入 en/ja/ko/de/es/fr/ru/th/vi/zh-TW(同批提交)。
 * 两账套均执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

DECLARE @keys TABLE (ref_key nvarchar(200));
INSERT INTO @keys (ref_key) VALUES (N'每箱数量'), (N'每箱'), (N'整箱'), (N'零头箱'), (N'不足每箱');

DECLARE @rows TABLE (ref_key nvarchar(200), locale varchar(10), text nvarchar(200));
INSERT INTO @rows (ref_key, locale, text) VALUES
  (N'每箱数量', 'en', N'Qty per box'),        (N'每箱数量', 'ja', N'1箱あたり数量'),
  (N'每箱数量', 'ko', N'상자당 수량'),         (N'每箱数量', 'de', N'Menge pro Karton'),
  (N'每箱数量', 'es', N'Cantidad por caja'),  (N'每箱数量', 'fr', N'Quantité par boîte'),
  (N'每箱数量', 'ru', N'Количество в коробке'),(N'每箱数量', 'th', N'จำนวนต่อกล่อง'),
  (N'每箱数量', 'vi', N'Số lượng mỗi thùng'), (N'每箱数量', 'zh-TW', N'每箱數量'),
  (N'每箱', 'en', N'Per box'),                (N'每箱', 'ja', N'1箱あたり'),
  (N'每箱', 'ko', N'상자당'),                  (N'每箱', 'de', N'Pro Karton'),
  (N'每箱', 'es', N'Por caja'),               (N'每箱', 'fr', N'Par boîte'),
  (N'每箱', 'ru', N'В коробке'),              (N'每箱', 'th', N'ต่อกล่อง'),
  (N'每箱', 'vi', N'Mỗi thùng'),              (N'每箱', 'zh-TW', N'每箱'),
  (N'整箱', 'en', N'Full boxes'),             (N'整箱', 'ja', N'満箱'),
  (N'整箱', 'ko', N'온박스'),                  (N'整箱', 'de', N'Volle Kartons'),
  (N'整箱', 'es', N'Cajas completas'),        (N'整箱', 'fr', N'Boîtes complètes'),
  (N'整箱', 'ru', N'Полные коробки'),         (N'整箱', 'th', N'กล่องเต็ม'),
  (N'整箱', 'vi', N'Thùng đầy'),              (N'整箱', 'zh-TW', N'整箱'),
  (N'零头箱', 'en', N'Partial box'),          (N'零头箱', 'ja', N'端数箱'),
  (N'零头箱', 'ko', N'잔여 상자'),             (N'零头箱', 'de', N'Restkarton'),
  (N'零头箱', 'es', N'Caja parcial'),         (N'零头箱', 'fr', N'Boîte partielle'),
  (N'零头箱', 'ru', N'Неполная коробка'),     (N'零头箱', 'th', N'กล่องไม่เต็ม'),
  (N'零头箱', 'vi', N'Thùng lẻ'),             (N'零头箱', 'zh-TW', N'零頭箱'),
  (N'不足每箱', 'en', N'less than a full box'),(N'不足每箱', 'ja', N'1箱に満たない'),
  (N'不足每箱', 'ko', N'1상자 미만'),          (N'不足每箱', 'de', N'weniger als ein Karton'),
  (N'不足每箱', 'es', N'menos de una caja'),  (N'不足每箱', 'fr', N'moins d''une boîte'),
  (N'不足每箱', 'ru', N'меньше коробки'),     (N'不足每箱', 'th', N'น้อยกว่าหนึ่งกล่อง'),
  (N'不足每箱', 'vi', N'ít hơn một thùng'),   (N'不足每箱', 'zh-TW', N'不足每箱');

DECLARE @key nvarchar(200), @loc varchar(10), @txt nvarchar(200), @n int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT ref_key, locale, text FROM @rows;
OPEN cur; FETCH NEXT FROM cur INTO @key, @loc, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field'
                   AND ref_key = @key AND locale = @loc)
    BEGIN
        INSERT INTO yj_translation (scope, ref_key, locale, text, source)
        VALUES ('field', @key, @loc, @txt, 'manual');
        SET @n = @n + 1;
    END
    FETCH NEXT FROM cur INTO @key, @loc, @txt;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'① 每箱数量相关词条:新插 ' + CAST(@n AS nvarchar(10)) + N' 条(已存在的不覆盖)';
GO

/* ---------- ② 自检:每条词条 ≥ 9 种语言(en/ja/ko/de/es/fr/ru/th/vi/zh-TW 中至少 9 落地) ---------- */
IF EXISTS (
    SELECT 1 FROM (VALUES (N'每箱数量'), (N'每箱'), (N'整箱'), (N'零头箱'), (N'不足每箱')) v(k)
    WHERE (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = v.k) < 9
)
    RAISERROR(N'自检失败:每箱数量相关词条语言数不足 9', 16, 1);

SELECT ref_key, COUNT(*) AS 语言数 FROM yj_translation
WHERE scope = 'field' AND ref_key IN (N'每箱数量', N'每箱', N'整箱', N'零头箱', N'不足每箱')
GROUP BY ref_key ORDER BY ref_key;
GO
PRINT N'✅ 每箱数量词条就绪';
GO
