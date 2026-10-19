/* ============================================================
   migrate-rd-owner-receipt-20261019.sql
   立项申请流程补「责任人确认收到」一步(2026-10-19 用户口径)

   用户原话:
     「给立项申请的流程改一下,就是管理员审批定级之后,分发给对接人,对接人签核然后选择责任人,
       责任人只需要确认收到就可以开始填写项目实施计划了,立项申请反审核,需要重新走流程,
       对应的项目实施计划也跟着反审核」

   目标流程(4 步):
     1 销售填写立项表
     2 冯总审核及定级(审批通过即定级,原样保留)
     3 分发对接人(审批人从账号里选对接人)+ 对接人签核并选项目责任人(原「确认责任人」)
     4 **责任人确认收到** ← 本脚本新增;确认之后才允许在「项目实施计划 RD_PLAN」里填单
     反审核:立项申请弃审 → 对接人/责任人/等级/「确认收到」一并清空,重新走流程;
             并按「文档编号」把挂着的项目实施计划一起反审核(代码见 ButtonService.unaudit)

   字段落位(不动表结构,沿用备用列池,先核占用:rd_approval 1 行,备用3/4/5 全空):
     · 备用3 → 标签「责任人确认」:存确认人账号(留痕),空 = 未确认
     · 备用4 → 标签「确认收到时间」:存 yyyy-MM-dd HH:mm:ss 字符串
   两个字段 hidden=1(流程程序读写,不进表头网格、不进纸面)。

   幂等:字段按 panel+col+place 判重;扩展属性判存在;译名按 scope/ref_key/locale 判重。
   顺序:本脚本已追加到 tools/db-migrations.txt 末尾;两个账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST)。
   ============================================================ */
SET NOCOUNT ON;
GO

-- ① 字段登记
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_APPROVAL' AND col_name = N'备用3' AND place = N'header')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                        display_field, place, seq, width, editable, required, hidden, visible)
  VALUES (N'RD_APPROVAL', N'备用3', N'责任人确认', N'文本', NULL, NULL, NULL,
          NULL, N'header', 220, 80, 0, 0, 1, 1);
  PRINT N'[OK] 字段登记:责任人确认(备用3)';
END
ELSE
  PRINT N'[--] 字段已存在:责任人确认(备用3)';
GO

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_APPROVAL' AND col_name = N'备用4' AND place = N'header')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                        display_field, place, seq, width, editable, required, hidden, visible)
  VALUES (N'RD_APPROVAL', N'备用4', N'确认收到时间', N'文本', NULL, NULL, NULL,
          NULL, N'header', 225, 80, 0, 0, 1, 1);
  PRINT N'[OK] 字段登记:确认收到时间(备用4)';
END
ELSE
  PRINT N'[--] 字段已存在:确认收到时间(备用4)';
GO

-- ② 列级中文注明
DECLARE @t nvarchar(80) = N'rd_approval';
DECLARE @n3 nvarchar(400) = N'责任人确认(原备用列池成员 备用3;2026-10-19 起承载「项目责任人确认收到」的账号:非空=已确认,确认后才能在项目实施计划 RD_PLAN 里填单。流程:定级→分发对接人→对接人签核并选责任人→责任人确认收到。存 username 非姓名)';
DECLARE @n4 nvarchar(400) = N'确认收到时间(原备用列池成员 备用4;2026-10-19 起承载责任人确认收到的时刻,yyyy-MM-dd HH:mm:ss 字符串。立项弃审时与备用3 一并清空)';

IF COL_LENGTH(@t, N'备用3') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(@t)
              AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t), N'备用3', 'ColumnId') AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @n3, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', N'备用3';
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', @n3, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', N'备用3';
END
IF COL_LENGTH(@t, N'备用4') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(@t)
              AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t), N'备用4', 'ColumnId') AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @n4, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', N'备用4';
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', @n4, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', N'备用4';
END
PRINT N'[OK] rd_approval.备用3/备用4 中文注明已更新';
GO

-- ③ 译名(10 语言;已存在的同 scope/ref_key/locale 不覆盖)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', v.ref_key, v.locale, v.text, N'manual'
FROM (VALUES
  (N'责任人确认',   'en',    N'Owner Receipt'),
  (N'责任人确认',   'zh-TW', N'責任人確認'),
  (N'责任人确认',   'ja',    N'責任者確認'),
  (N'责任人确认',   'ko',    N'책임자 확인'),
  (N'责任人确认',   'es',    N'Confirmación del responsable'),
  (N'责任人确认',   'fr',    N'Accusé du responsable'),
  (N'责任人确认',   'de',    N'Bestätigung Verantwortlicher'),
  (N'责任人确认',   'ru',    N'Подтверждение ответственного'),
  (N'责任人确认',   'vi',    N'Xác nhận người phụ trách'),
  (N'责任人确认',   'th',    N'การยืนยันผู้รับผิดชอบ'),
  (N'确认收到时间', 'en',    N'Receipt Time'),
  (N'确认收到时间', 'zh-TW', N'確認收到時間'),
  (N'确认收到时间', 'ja',    N'受領確認日時'),
  (N'确认收到时间', 'ko',    N'수신 확인 시간'),
  (N'确认收到时间', 'es',    N'Hora de confirmación'),
  (N'确认收到时间', 'fr',    N'Heure de réception'),
  (N'确认收到时间', 'de',    N'Bestätigungszeit'),
  (N'确认收到时间', 'ru',    N'Время подтверждения'),
  (N'确认收到时间', 'vi',    N'Thời gian xác nhận'),
  (N'确认收到时间', 'th',    N'เวลายืนยันรับทราบ')
) AS v(ref_key, locale, text)
WHERE NOT EXISTS (
  SELECT 1 FROM yj_translation x
  WHERE x.scope = N'field' AND x.ref_key = v.ref_key AND x.locale = v.locale);
PRINT N'[OK] 译名(责任人确认/确认收到时间 × 10 语言)已补';
GO

-- ④ 自检
DECLARE @f int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code = N'RD_APPROVAL' AND col_name IN (N'备用3', N'备用4') AND hidden = 1);
DECLARE @col int = (SELECT COUNT(*) FROM sys.columns
                     WHERE name IN (N'备用3', N'备用4') AND object_id = OBJECT_ID('rd_approval'));
DECLARE @tr int = (SELECT COUNT(*) FROM yj_translation
                    WHERE scope = N'field' AND ref_key IN (N'责任人确认', N'确认收到时间'));
IF @f = 2 AND @col = 2 AND @tr >= 20
  PRINT N'[OK] 自检通过:字段 2/2、物理列 2/2、译名 ' + CAST(@tr AS nvarchar(4)) + N'/20';
ELSE
  PRINT N'[WARN] 自检异常:字段 ' + CAST(@f AS nvarchar(3)) + N'/2、物理列 ' + CAST(@col AS nvarchar(3))
        + N'/2、译名 ' + CAST(@tr AS nvarchar(4)) + N'/20';
GO
