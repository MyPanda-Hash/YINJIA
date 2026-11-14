/* ============================================================================
 * i18n-pu-label-box-qty2-20261111.sql —— 「每箱数量」第二轮新增词条(2026-11-11)
 * ----------------------------------------------------------------------------
 * 同日追加口径:「这个设计为必填」+「打印份数还是通过 打印数量/每箱数量 计算出来,零头箱也根据计算带出」
 *   +「还要记录的打印里面对零头箱做标记」。
 * ⇒ 记录表新增两列「标签张数」「零头箱」,提示语改成"{n} 张(零头自动出卡)"。
 *
 * 本脚本只补**尚缺**的两条显示层词条(scope='field'):
 *   ① 标签张数 —— 已打印记录里"这批打了几张卡";
 *   ② 共 {n} 张 —— 弹窗底部逐行提示的张数句式。
 * 其余词条(必填/每箱数量/每箱/整箱/零头箱/不足每箱)**逐条实测 yj_translation 早已齐备 10 语言**,不重复插。
 *
 * 幂等:逐(词条 × 语言)判重,已存在即跳过,不覆盖人工校对。
 * 前端静态包 src/i18n/locales 下 10 个语言文件同批加入(含撤掉第一轮那 4 条已废提示)。
 * 两账套均执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

DECLARE @rows TABLE (ref_key nvarchar(200), locale varchar(10), text nvarchar(200));
INSERT INTO @rows (ref_key, locale, text) VALUES
  (N'标签张数', 'en', N'Labels'),        (N'标签张数', 'ja', N'ラベル枚数'),
  (N'标签张数', 'ko', N'라벨 수'),        (N'标签张数', 'de', N'Etiketten'),
  (N'标签张数', 'es', N'Etiquetas'),     (N'标签张数', 'fr', N'Étiquettes'),
  (N'标签张数', 'ru', N'Этикеток'),      (N'标签张数', 'th', N'จำนวนป้าย'),
  (N'标签张数', 'vi', N'Số nhãn'),       (N'标签张数', 'zh-TW', N'標籤張數'),
  (N'共 {n} 张', 'en', N'{n} labels'),   (N'共 {n} 张', 'ja', N'計 {n} 枚'),
  (N'共 {n} 张', 'ko', N'총 {n}장'),      (N'共 {n} 张', 'de', N'{n} Etiketten'),
  (N'共 {n} 张', 'es', N'{n} etiquetas'),(N'共 {n} 张', 'fr', N'{n} étiquettes'),
  (N'共 {n} 张', 'ru', N'Всего {n} этикеток'), (N'共 {n} 张', 'th', N'ทั้งหมด {n} ป้าย'),
  (N'共 {n} 张', 'vi', N'Tổng {n} nhãn'),(N'共 {n} 张', 'zh-TW', N'共 {n} 張');

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
PRINT N'① 标签张数 / 共 {n} 张:新插 ' + CAST(@n AS nvarchar(10)) + N' 条(已存在的不覆盖)';
GO

/* ---------- ② 自检 ---------- */
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'标签张数') < 9
    RAISERROR(N'自检失败:「标签张数」词条不足 9 种语言', 16, 1);
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'共 {n} 张') < 9
    RAISERROR(N'自检失败:「共 {n} 张」词条不足 9 种语言', 16, 1);

SELECT ref_key, COUNT(*) AS 语言数 FROM yj_translation
WHERE scope = 'field' AND ref_key IN (N'标签张数', N'共 {n} 张')
GROUP BY ref_key ORDER BY ref_key;
GO
PRINT N'✅ 标签张数 / 共 {n} 张 词条就绪';
GO
