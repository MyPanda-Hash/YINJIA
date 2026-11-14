/* ============================================================================
 * i18n-pu-print-buyer-contact-20261111.sql —— 「送货单 / 需方联系人」显示层词条(2026-11-11)
 * ----------------------------------------------------------------------------
 * 同批代码交付:
 *   · 无金额版标题改「送货单」、下方不印供方/需方(纯版式,无需词条 —— 纸面标题是**固定中文**,
 *     与「银嘉采购订单」同口径,**不进翻译表**:报表抬头属单据模板,不随界面语言变);
 *   · 有金额版打印前弹窗里新增「需方联系人 / 联系方式」下拉(可新增) —— 这两个是**字段标签**,
 *     按《多语言强制规范》补 scope='field' 10 语言;弹窗里的占位词/说明句只进前端静态包。
 *
 * 幂等:逐(词条 × 语言)判重,已存在即跳过,不覆盖人工校对。
 * 两账套均执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

DECLARE @rows TABLE (ref_key nvarchar(200), locale varchar(10), text nvarchar(200));
INSERT INTO @rows (ref_key, locale, text) VALUES
  (N'需方联系人', 'en', N'Buyer contact'),      (N'需方联系人', 'ja', N'発注者側の担当者'),
  (N'需方联系人', 'ko', N'수요측 담당자'),        (N'需方联系人', 'de', N'Ansprechpartner Käufer'),
  (N'需方联系人', 'es', N'Contacto del comprador'), (N'需方联系人', 'fr', N'Contact de l''acheteur'),
  (N'需方联系人', 'ru', N'Контактное лицо покупателя'), (N'需方联系人', 'th', N'ผู้ติดต่อฝ่ายผู้ซื้อ'),
  (N'需方联系人', 'vi', N'Người liên hệ bên mua'), (N'需方联系人', 'zh-TW', N'需方聯繫人'),
  (N'联系方式', 'en', N'Phone'),                (N'联系方式', 'ja', N'連絡先'),
  (N'联系方式', 'ko', N'연락처'),                 (N'联系方式', 'de', N'Telefon'),
  (N'联系方式', 'es', N'Teléfono'),             (N'联系方式', 'fr', N'Téléphone'),
  (N'联系方式', 'ru', N'Телефон'),              (N'联系方式', 'th', N'เบอร์ติดต่อ'),
  (N'联系方式', 'vi', N'Số liên hệ'),           (N'联系方式', 'zh-TW', N'聯繫方式');

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
PRINT N'① 需方联系人 / 联系方式:新插 ' + CAST(@n AS nvarchar(10)) + N' 条(已存在的不覆盖)';
GO

/* ---------- ② 自检 ---------- */
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'需方联系人') < 9
    RAISERROR(N'自检失败:「需方联系人」词条不足 9 种语言', 16, 1);
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'联系方式') < 9
    RAISERROR(N'自检失败:「联系方式」词条不足 9 种语言', 16, 1);

SELECT ref_key, COUNT(*) AS 语言数 FROM yj_translation
WHERE scope = 'field' AND ref_key IN (N'需方联系人', N'联系方式')
GROUP BY ref_key ORDER BY ref_key;
GO
PRINT N'✅ 送货单/需方联系人词条就绪';
GO
