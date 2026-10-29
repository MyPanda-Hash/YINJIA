/* ============================================================================
 * i18n-supplier-account-phone-20261025.sql —— 「供应商账号」弹窗新文案译名
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-25):「新增应该弹窗关联供应商,然后选择后账号默认供应商编码(可修改)。可以有联系电话」
 * 本脚本补这场改动新增的界面文案(scope=field,与前端 tt() 同一批键):
 *   联系电话 / 电话占位 / 「选定供应商后账号自动填编码…」说明 / 账号占位 / 已自动填写提示
 * 已存在即跳过(不覆盖人工校对);幂等可重跑。两账套均需执行。
 * 前端静态语言包同一批词条由 tools/archive/_gen-supplier-portal-i18n.mjs 生成。
 * ========================================================================== */

SET NOCOUNT ON;
GO

DECLARE @t TABLE (ref_key nvarchar(400) NOT NULL, locale nvarchar(10) NOT NULL, text nvarchar(900) NOT NULL);

INSERT INTO @t (ref_key, locale, text) VALUES
 (N'联系电话', 'en', N'Phone'), (N'联系电话', 'ja', N'電話番号'), (N'联系电话', 'ko', N'연락처'),
 (N'联系电话', 'de', N'Telefon'), (N'联系电话', 'es', N'Teléfono'), (N'联系电话', 'fr', N'Téléphone'),
 (N'联系电话', 'ru', N'Телефон'), (N'联系电话', 'vi', N'Điện thoại'), (N'联系电话', 'th', N'โทรศัพท์'),

 (N'选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。', 'en',
  N'Once a supplier is selected the account defaults to its supplier code (editable); the name defaults to the supplier name.'),
 (N'选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。', 'ja',
  N'仕入先を選ぶとアカウントは仕入先コードが自動入力され(変更可)、氏名は仕入先名が既定値になります。'),
 (N'选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。', 'ko',
  N'공급업체를 선택하면 계정에 해당 공급업체 코드가 자동 입력되며(수정 가능), 이름은 공급업체명이 기본값입니다.'),
 (N'选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。', 'de',
  N'Nach Auswahl des Lieferanten wird das Konto mit dessen Code vorbelegt (änderbar); der Name kommt vom Lieferantennamen.'),
 (N'选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。', 'es',
  N'Al elegir un proveedor, la cuenta se rellena con su código (editable); el nombre toma el del proveedor.'),
 (N'选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。', 'fr',
  N'Une fois le fournisseur choisi, le compte reprend son code (modifiable) ; le nom est celui du fournisseur.'),
 (N'选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。', 'ru',
  N'После выбора поставщика в аккаунт подставляется его код (можно изменить), имя берётся из наименования поставщика.'),
 (N'选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。', 'vi',
  N'Sau khi chọn nhà cung cấp, tài khoản tự điền mã nhà cung cấp (có thể sửa); họ tên lấy theo tên nhà cung cấp.'),
 (N'选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。', 'th',
  N'เมื่อเลือกผู้จัดจำหน่าย บัญชีจะเติมรหัสผู้จัดจำหน่ายให้อัตโนมัติ (แก้ไขได้) และชื่อจะใช้ชื่อผู้จัดจำหน่าย'),

 (N'默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)', 'en',
  N'Defaults to the supplier code, editable (3-40 letters/digits/underscore/dot/hyphen)'),
 (N'默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)', 'ja',
  N'既定値=仕入先コード(変更可、3~40 文字)'),
 (N'默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)', 'ko',
  N'기본값=공급업체 코드, 수정 가능 (3~40자)'),
 (N'默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)', 'de',
  N'Standard = Lieferantencode, änderbar (3-40 Zeichen)'),
 (N'默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)', 'es',
  N'Por defecto = código de proveedor, editable (3-40 caracteres)'),
 (N'默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)', 'fr',
  N'Par défaut = code fournisseur, modifiable (3 à 40 caractères)'),
 (N'默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)', 'ru',
  N'По умолчанию = код поставщика, можно изменить (3-40 символов)'),
 (N'默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)', 'vi',
  N'Mặc định = mã nhà cung cấp, có thể sửa (3-40 ký tự)'),
 (N'默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)', 'th',
  N'ค่าเริ่มต้น = รหัสผู้จัดจำหน่าย แก้ไขได้ (3-40 ตัวอักษร)'),

 (N'已按供应商编码自动填写,可直接修改。', 'en', N'Filled from the supplier code - you can edit it.'),
 (N'已按供应商编码自动填写,可直接修改。', 'ja', N'仕入先コードを自動入力しました。変更できます。'),
 (N'已按供应商编码自动填写,可直接修改。', 'ko', N'공급업체 코드로 자동 입력되었습니다. 수정할 수 있습니다.'),
 (N'已按供应商编码自动填写,可直接修改。', 'de', N'Aus dem Lieferantencode vorbelegt - änderbar.'),
 (N'已按供应商编码自动填写,可直接修改。', 'es', N'Rellenado con el código del proveedor; puede editarlo.'),
 (N'已按供应商编码自动填写,可直接修改。', 'fr', N'Pré-rempli avec le code fournisseur - modifiable.'),
 (N'已按供应商编码自动填写,可直接修改。', 'ru', N'Заполнено кодом поставщика - можно изменить.'),
 (N'已按供应商编码自动填写,可直接修改。', 'vi', N'Đã điền theo mã nhà cung cấp - có thể sửa.'),
 (N'已按供应商编码自动填写,可直接修改。', 'th', N'เติมจากรหัสผู้จัดจำหน่ายแล้ว แก้ไขได้');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', t.ref_key, t.locale, t.text, N'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = N'field' AND x.ref_key = t.ref_key AND x.locale = t.locale);
PRINT N'供应商账号弹窗新文案译名已写入(已存在的不覆盖)';
GO

/* ---------- 自检:每个键 9 语言 ---------- */
DECLARE @bad nvarchar(400) = N'';
SELECT @bad = @bad + ref_key + N'(' + CAST(c AS varchar) + N')'
  FROM (SELECT ref_key, COUNT(*) AS c FROM yj_translation
         WHERE scope = N'field' AND source = N'manual'
           AND ref_key IN (N'联系电话',
                           N'选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。',
                           N'默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)',
                           N'已按供应商编码自动填写,可直接修改。')
         GROUP BY ref_key) t
 WHERE c < 9;
IF @bad <> N'' RAISERROR(N'自检失败:以下词条语言数不足 9: %s', 16, 1, @bad);

SELECT ref_key AS 文案, COUNT(*) AS 语言数 FROM yj_translation
 WHERE scope = N'field'
   AND ref_key IN (N'联系电话',
                   N'选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。',
                   N'默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)',
                   N'已按供应商编码自动填写,可直接修改。')
 GROUP BY ref_key;
GO
PRINT N'✅ 供应商账号弹窗文案译名就绪';
GO
