/* ============================================================
   migrate-wo-pick-return-flag-field-20261030.sql — 把「退料标志」列登记成面板字段

   用户口径(2026-10-30 第三轮):「退料的单据做一个退料的标志」。

   ------------------------------------------------------------
   ★ 为什么还要这一步(上一脚本只加了物理列)
   ------------------------------------------------------------
   `ButtonService.save` **只写 yj_field 里登记过的字段**
   (见 PanelConfigService/PanelRegistry 的字段驱动保存:formData 里没登记的键会被丢弃)。
   所以只 `ALTER TABLE ... ADD 退料标志` 是不够的 —— 接口传了「退料标志」也**静默不落库**
   (2026-10-30 实测:单据头 退料标志 = NULL,而其他字段都写进去了)。

   ⇒ 本脚本把 `bd_other_in.退料标志` 登记进 OTHER_IN 面板:
     · place = header,visible = 1,**hidden = 0** —— 让它在其他入库单面板里也看得见
       (仓库人员打开一张退料单,应当一眼看出这是退料,而不是普通其他入库);
     · editable = 0(只读):这个值由系统写入,不允许人手改 ——
       改了就等于把"退料"伪装成普通入库;
     · 补 9 语言译名(AGENTS 硬规范:新增字段必须同时交付译名)。

   幂等:yj_field 判四元组存在、yj_translation 判 (scope,ref_key,locale)。
   两账套都执行,已登记 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ---------- ① yj_field 登记 ----------
   ⚠ 列名以实际表结构为准(2026-10-30 实测):
      yj_field = panel_code / col_name / label / data_type / place / seq / width /
                 editable / required / hidden / visible / alias / label_en / dict_sql / ...
     **没有** field_type 列(是 data_type);editable/required/hidden/visible 都是 NOT NULL 的 bit。
     editable=0 且 required=0 且 hidden=0 且 visible=1 —— 只读、可见、不必填。 */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'OTHER_IN' AND label = N'退料标志')
BEGIN
    INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, place, seq, width,
                              editable, required, hidden, visible, alias, label_en)
    VALUES (N'OTHER_IN', N'退料标志', N'退料标志', N'text', N'header', 185, 120,
            0, 0, 0, 1, NULL, N'Return flag');
    PRINT N'[OK] yj_field + OTHER_IN.退料标志(header/seq 185/只读/可见)';
END
ELSE PRINT N'[SKIP] yj_field 已有 OTHER_IN.退料标志';
GO

-- 已存在但被设成隐藏/必填的,纠正过来(幂等:只改这几列,不动用户别名与顺序)
UPDATE dbo.yj_field
   SET hidden = 0, visible = 1, required = 0, editable = 0
 WHERE panel_code = N'OTHER_IN' AND label = N'退料标志';
GO

/* ---------- ② 字段译名(9 语言) ---------- */
DECLARE @tr TABLE (locale varchar(10), text nvarchar(200));
INSERT INTO @tr (locale, text) VALUES
 ('en', N'Return flag'),
 ('ja', N'返却フラグ'),
 ('ko', N'반납 표시'),
 ('es', N'Marca de devolución'),
 ('fr', N'Marqueur de retour'),
 ('de', N'Rückgabe-Kennzeichen'),
 ('ru', N'Признак возврата'),
 ('vi', N'Dấu trả hàng'),
 ('th', N'เครื่องหมายคืน');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'退料标志', t.locale, t.text, 'manual'
  FROM @tr t
 WHERE NOT EXISTS (
         SELECT 1 FROM yj_translation x
          WHERE x.scope = 'field' AND x.ref_key = N'退料标志' AND x.locale = t.locale);
GO

/* ---------- ③ 自检 ---------- */
DECLARE @fieldOk int, @trOk int, @colOk int;
SELECT @fieldOk = COUNT(*) FROM yj_field WHERE panel_code = N'OTHER_IN' AND label = N'退料标志';
SELECT @trOk = COUNT(DISTINCT locale) FROM yj_translation
 WHERE scope = 'field' AND ref_key = N'退料标志';
SELECT @colOk = CASE WHEN COL_LENGTH('dbo.bd_other_in', '退料标志') IS NOT NULL THEN 1 ELSE 0 END;

IF @colOk = 0    RAISERROR(N'[FAIL] 物理列 bd_other_in.退料标志 不存在(先跑 migrate-wo-pick-return-20261030.sql)', 16, 1);
IF @fieldOk = 0  RAISERROR(N'[FAIL] yj_field 没登记 OTHER_IN.退料标志 ⇒ 保存时该字段会被丢弃', 16, 1);
IF @trOk < 9     RAISERROR(N'[FAIL] 退料标志 译名只有 %d 种语言(应 9)', 16, 1, @trOk);

IF @colOk = 1 AND @fieldOk > 0 AND @trOk >= 9
   PRINT N'[PASS] 退料标志:物理列 + yj_field 登记 + 9 语言译名齐备';
GO
