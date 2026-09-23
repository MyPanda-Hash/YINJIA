-- _q-pin-tc-verify.sql — 迁移后核验:列/注明/元数据/回填
SET NOCOUNT ON;
PRINT N'① 列与注明';
SELECT c.name AS 列, t.name AS 类型, c.max_length, c.is_nullable,
       (SELECT CAST(ep.value AS nvarchar(400)) FROM sys.extended_properties ep
         WHERE ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description') AS 注明
  FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('dbo.bl_purchase_in') AND c.name IN (N'特采', N'是否来料检验');
GO
PRINT N'② yj_field 登记';
SELECT panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible
  FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name IN (N'特采', N'是否来料检验') ORDER BY seq;
GO
PRINT N'③ 回填分布';
SELECT ISNULL(p.[特采], N'(空)') AS 特采值, COUNT(*) AS 行数 FROM bl_purchase_in p GROUP BY p.[特采];
GO
PRINT N'④ 特采链路单据是否都已标是';
SELECT COUNT(*) AS 特采链路单据数,
       SUM(CASE WHEN p.特采 = N'是' THEN 1 ELSE 0 END) AS 已标是的单据数
  FROM (SELECT DISTINCT l.target_form_no,
               (SELECT TOP 1 p.[特采] FROM bl_purchase_in p WHERE p.单据编号 = l.target_form_no) AS 特采
          FROM form_flow_link l
         WHERE l.source_panel_code='QC_TC_IN' AND l.target_panel_code='PURCHASE_IN') x
  JOIN bl_purchase_in p ON p.单据编号 = x.target_form_no;
GO
PRINT N'⑤ 译名';
SELECT COUNT(*) AS 特采译名条数 FROM yj_translation WHERE scope='field' AND ref_key=N'特采';
GO
