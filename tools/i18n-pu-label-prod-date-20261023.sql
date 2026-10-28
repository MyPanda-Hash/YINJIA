/* ============================================================================
 * 采购订单「打印材料码」新增 UI 词条:选择日期(2026-10-23)
 * ----------------------------------------------------------------------------
 * 背景:同一需求给弹窗批次号右边加了「生产日期」日期框。字段本身的两条词条
 *   (ref_key = 生产日期 / 批次号,scope='field')**早已在 yj_translation 里齐备**
 *   (逐条实测 en/ja/ko/de/es/fr/ru/th/vi/zh-TW 全覆盖,source='manual'),故本脚本不重复插。
 * 本次只缺日期框的占位词「选择日期」(属**显示层 UI 文案**,scope='field',
 *   与 yj_translation 里其他按钮/占位词同口径);前端静态包已同步加入 en/ja/ko/de/es/fr/
 *   ru/th/vi/zh-TW,**本脚本只在不存在的语言上补插**(幂等:已存在即跳过,不覆盖人工校对)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

DECLARE @rows TABLE (locale varchar(10), text nvarchar(200));
INSERT INTO @rows (locale, text) VALUES
  ('en', N'Select date'),
  ('ja', N'日付を選択'),
  ('ko', N'날짜 선택'),
  ('de', N'Datum wählen'),
  ('es', N'Seleccionar fecha'),
  ('fr', N'Sélectionner la date'),
  ('ru', N'Выбрать дату'),
  ('th', N'เลือกวันที่'),
  ('vi', N'Chọn ngày'),
  ('zh-TW', N'選擇日期');

DECLARE @loc varchar(10), @txt nvarchar(200), @n int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT locale, text FROM @rows;
OPEN cur; FETCH NEXT FROM cur INTO @loc, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field'
                   AND ref_key = N'选择日期' AND locale = @loc)
    BEGIN
        INSERT INTO yj_translation (scope, ref_key, locale, text, source)
        VALUES ('field', N'选择日期', @loc, @txt, 'manual');
        SET @n = @n + 1;
    END
    FETCH NEXT FROM cur INTO @loc, @txt;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'① 选择日期:新插 ' + CAST(@n AS nvarchar(10)) + N' 条(已存在的不覆盖)';
GO

/* ---------- ② 自检 ---------- */
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'选择日期') < 10
    RAISERROR(N'自检失败:「选择日期」词条不足 10 种语言', 16, 1);

SELECT ref_key, locale, text, source FROM yj_translation
WHERE scope = 'field' AND ref_key = N'选择日期' ORDER BY locale;
GO
PRINT N'✅ 选择日期词条就绪';
GO
