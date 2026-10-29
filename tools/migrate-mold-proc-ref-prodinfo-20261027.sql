/* =============================================================================
   migrate-mold-proc-ref-prodinfo-20261027.sql
   -----------------------------------------------------------------------------
   用户口径(2026-10-27,1027系统使用-产品工艺文件问题点待改善 #3 / #4):
     #3 「产品管控类型:名称改为【产品管控等级】其内容引用产品信息表对应字段的内容。」
     #4 「产品形态:其内容引用产品信息表对应字段的内容。」
   用户另确认:「历史单据不报错就行」⇒ 不强制回填历史值,只保证不炸。

   现状(实测 HSDZ_MES):
     · RD_MOLD_PROC.产品管控类型  下拉框,字典 = ·重点管控产品 / ·一般管控产品
     · RD_MOLD_PROC.外观要求     下拉框,字典 = ·成品 / ·半成品   (alias 已经是「产品形态」)
     · RD_MOLD_FORMULA 同上两格(配方页与工艺页共用同一张单,必须一起改,否则翻页看到两套)
     · RD_PROD_INFO.产品管控等级  标准库 prod.ctrl_level = 重点产品 / KPC产品 / 其他
     · RD_PROD_INFO.产品形态      标准库 prod.form      = 包布 / 套网 / 打端盖 / 套PP棉

   ⚠⚠ 两套取值体系本来就不同(·重点管控产品 ≠ 重点产品)。改成参照后:
     · 新单:选「产品编号」时由 refMap **同名/同义自动带回**目标面板同名字段的值
       (靠的是 buildRefMap 的 label 相等,故本脚本必须让两个面板的字段名一致 —— 见 ②);
     · 历史单:纸面照原值显示(参照格在只读态就是一段文本),**不会报错、不会丢值**;
       用户重新点参照并确认时才会被新值覆盖(这是用户要的"引用产品信息表"的语义)。

   改法(选 A:真参照,不是换成同词表的下拉):
     · data_type  = N'参照'
     · ref_panel  = N'RD_PROD_INFO'
     · ref_field  = 目标面板的**字段标签(label)** ——
         ⚠ 按 AGENTS.md 采购链 §5:ref_field 取的是**目标面板的字段名(label)**,不是物理列名。
           实测 RD_PROD_INFO 的 label 与 col_name 在这两格上恰好同名(产品管控等级 / 产品形态),
           但写法仍按 label 走,别写成列名。
     · dict_sql   = NULL(参照格不再有下拉字典)
     · alias      = N'产品管控等级'(#3 的改名;数据键 col_name 仍是「产品管控类型」,**不动**)

   ⚠ 为什么 col_name 不改:数据键 (col_name/yj_field.label) 一旦改,历史单据的列就对不上,
     参照链路、四文件门禁、配方回填全部按 label 走(见 recordSheetConfigs 头注)。
     用户要的是**纸面名字**改成「产品管控等级」,alias 就是干这个的。

   幂等:所有 UPDATE 都带窄条件 + 重复执行结果相同。
   两账套都要跑(先 HSDZ_MES,后 HSDZ_MES_TEST)。
   ============================================================================= */

SET NOCOUNT ON;
GO

PRINT N'=== 改前 ===';
SELECT panel_code, seq, col_name, label, alias, data_type, ref_panel, ref_field
  FROM dbo.yj_field
 WHERE panel_code IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA')
   AND col_name IN (N'产品管控类型', N'外观要求')
 ORDER BY panel_code, col_name;
GO

/* ---------- ① RD_MOLD_PROC:产品管控类型 → 参照 RD_PROD_INFO.产品管控等级 ---------- */
UPDATE dbo.yj_field
   SET data_type = N'参照',
       ref_panel = N'RD_PROD_INFO',
       ref_field = N'产品管控等级',
       display_field = N'产品管控等级',
       dict_sql  = NULL,
       alias     = N'产品管控等级'
 WHERE panel_code = N'RD_MOLD_PROC'
   AND col_name   = N'产品管控类型';
PRINT N'[①] RD_MOLD_PROC.产品管控类型 → 参照: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ② RD_MOLD_PROC:外观要求(产品形态)→ 参照 RD_PROD_INFO.产品形态 ---------- */
UPDATE dbo.yj_field
   SET data_type = N'参照',
       ref_panel = N'RD_PROD_INFO',
       ref_field = N'产品形态',
       display_field = N'产品形态',
       dict_sql  = NULL,
       alias     = N'产品形态'
 WHERE panel_code = N'RD_MOLD_PROC'
   AND col_name   = N'外观要求';
PRINT N'[②] RD_MOLD_PROC.外观要求 → 参照 产品形态: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ③ RD_MOLD_FORMULA 同两格(配方页;与工艺页共用一张单,必须同步) ---------- */
UPDATE dbo.yj_field
   SET data_type = N'参照',
       ref_panel = N'RD_PROD_INFO',
       ref_field = N'产品管控等级',
       display_field = N'产品管控等级',
       dict_sql  = NULL,
       alias     = N'产品管控等级'
 WHERE panel_code = N'RD_MOLD_FORMULA'
   AND col_name   = N'产品管控类型';
PRINT N'[③] RD_MOLD_FORMULA.产品管控类型 → 参照: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

UPDATE dbo.yj_field
   SET data_type = N'参照',
       ref_panel = N'RD_PROD_INFO',
       ref_field = N'产品形态',
       display_field = N'产品形态',
       dict_sql  = NULL,
       alias     = N'产品形态'
 WHERE panel_code = N'RD_MOLD_FORMULA'
   AND col_name   = N'外观要求';
PRINT N'[④] RD_MOLD_FORMULA.外观要求 → 参照 产品形态: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ⑤ 多语言:新增「产品管控等级」显示名 ----------
   AGENTS 多语言强制规范:新增字段/改名必须同时给译名。此处 ref_key 用**新显示名**,
   因为翻译键走的是 label/alias 展示口径(见 i18n 分层规则)。
   ⚠ 逐条判断再插:已存在的键不覆盖(避免把人工校对过的译本冲掉)。 */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope='field' AND ref_key=N'产品管控等级' AND locale='en')
  INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品管控等级', 'en', N'Control Level', 'manual');
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope='field' AND ref_key=N'产品管控等级' AND locale='ja')
  INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品管控等级', 'ja', N'管理レベル', 'manual');
PRINT N'[⑤] 产品管控等级 译名已补(缺则插)';
GO

PRINT N'=== 改后 ===';
SELECT panel_code, seq, col_name, label, alias, data_type, ref_panel, ref_field
  FROM dbo.yj_field
 WHERE panel_code IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA')
   AND col_name IN (N'产品管控类型', N'外观要求')
 ORDER BY panel_code, col_name;

/* ---------- 自证:越界数必须为 0 ---------- */
PRINT N'=== 自证 ===';
SELECT N'目标 4 行是否全变参照(应=4)' AS 项, COUNT(*) AS 数 FROM dbo.yj_field
 WHERE panel_code IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA')
   AND col_name IN (N'产品管控类型', N'外观要求')
   AND data_type = N'参照' AND ref_panel = N'RD_PROD_INFO';

-- 越界守卫:除目标 4 行外,别的面板同名列不得被改成参照
-- (组装BOM表/组装工艺清单的「外观要求」是明细文本列,本来就不是下拉,不该动)
SELECT N'越界被改成参照的行数(应=0)' AS 项, COUNT(*) AS 数 FROM dbo.yj_field
 WHERE col_name IN (N'产品管控类型', N'外观要求')
   AND panel_code NOT IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA')
   AND data_type = N'参照';
GO
