/* _3-reapply-qcinsp.sql — 覆盖服务器备份后,把「来料检验单」整条链按覆盖前本地状态写回
   (2026-10-20 用户口径:RESTORE 覆盖本地,但不覆盖当前的来料检验单的库)

   前置:_1-keep-qcinsp.sql 已把快照存进 HSDZ_MES_KEEPQC(17 张头 / 24 明细 / 26 状态 / 21 审批 / 8 检验记录 / 2 特采单 / 31 链路)
   做法:
     ① qc_insp / qc_insp_detail 全删后按快照整表回插(保留原 id);
     ② yj_doc_status / yj_form_approval 只清 QC_INSP 面板的行,再按快照回插;
     ③ qc_insp_rec / qc_tc_in / form_flow_link 只补快照里缺失的行(按 单据编号 / id 判重)。
   用法(在 tools 目录,恢复 + DbSync 之后执行):
     docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P *** -d HSDZ_MES -C -b -f 65001 -i /tmp/_3-reapply-qcinsp.sql"
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
/* sqlcmd 默认 QUOTED_IDENTIFIER OFF,.value()/XML 与索引视图会报 1934 ⇒ 单独一批先把 SET 打开 */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_ID('HSDZ_MES_KEEPQC') IS NULL
BEGIN
  RAISERROR(N'[FAIL] 快照库 HSDZ_MES_KEEPQC 不存在,先跑 _1-keep-qcinsp.sql', 16, 1);
  RETURN;
END

DECLARE @keep int = (SELECT COUNT(*) FROM HSDZ_MES_KEEPQC.dbo.k_qc_insp);
PRINT N'[0] 快照单据数 = ' + CAST(@keep AS nvarchar(10));
IF @keep = 0
BEGIN
  RAISERROR(N'[FAIL] 快照为空,禁止执行(否则会清空来料检验单)', 16, 1);
  RETURN;
END

BEGIN TRAN;

/* ① 先清掉备份带来的来料检验单(整面板),② 状态/审批只清 QC_INSP 面板 */
DELETE FROM dbo.qc_insp_detail;
PRINT N'[del] qc_insp_detail -' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.qc_insp;
PRINT N'[del] qc_insp -' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.yj_doc_status WHERE panel_code = 'QC_INSP';
PRINT N'[del] yj_doc_status(QC_INSP) -' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.yj_form_approval WHERE panel_code = 'QC_INSP';
PRINT N'[del] yj_form_approval(QC_INSP) -' + CAST(@@ROWCOUNT AS nvarchar(10));

/* 通用回插:按目标表列 ∩ 快照表列 生成 INSERT(自动处理 IDENTITY) */
CREATE TABLE #c (n int IDENTITY(1,1), t sysname, k sysname, w nvarchar(max));
INSERT #c (t, k, w) VALUES
  ('qc_insp',          'k_qc_insp',          N''),
  ('qc_insp_detail',   'k_qc_insp_detail',   N''),
  ('yj_doc_status',    'k_doc_status',       N''),
  ('yj_form_approval', 'k_form_approval',    N''),
  ('qc_insp_rec',      'k_qc_insp_rec',      N'NOT EXISTS (SELECT 1 FROM dbo.qc_insp_rec r WHERE r.单据编号 = k.单据编号)'),
  ('qc_tc_in',         'k_qc_tc_in',         N'NOT EXISTS (SELECT 1 FROM dbo.qc_tc_in t WHERE t.单据编号 = k.单据编号)'),
  ('form_flow_link',   'k_form_flow_link',   N'NOT EXISTS (SELECT 1 FROM dbo.form_flow_link f WHERE f.id = k.id)');

DECLARE @i int = 1, @n int = (SELECT COUNT(*) FROM #c), @t sysname, @k sysname, @w nvarchar(max);
DECLARE @cols nvarchar(max), @sql nvarchar(max), @ident bit;
WHILE @i <= @n
BEGIN
  SELECT @t = t, @k = k, @w = w FROM #c WHERE n = @i;

  SELECT @cols = STUFF((
      SELECT ',' + QUOTENAME(c.name)
        FROM sys.columns c
       WHERE c.object_id = OBJECT_ID('dbo.' + @t)
         AND c.is_computed = 0
         AND TYPE_NAME(c.user_type_id) NOT IN ('timestamp', 'rowversion')
         AND EXISTS (SELECT 1 FROM HSDZ_MES_KEEPQC.sys.columns kc
                      WHERE kc.object_id = OBJECT_ID('HSDZ_MES_KEEPQC.dbo.' + @k)
                        AND kc.name = c.name)
       ORDER BY c.column_id
       FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, '');

  SELECT @ident = MAX(CAST(is_identity AS int)) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.' + @t);

  SET @sql = N'INSERT INTO dbo.' + QUOTENAME(@t) + N' (' + @cols + N') SELECT ' + @cols
           + N' FROM HSDZ_MES_KEEPQC.dbo.' + QUOTENAME(@k) + N' k WHERE '
           + CASE WHEN ISNULL(@w, N'') = N'' THEN N'1=1' ELSE @w END;
  IF @ident = 1
    SET @sql = N'SET IDENTITY_INSERT dbo.' + QUOTENAME(@t) + N' ON; ' + @sql
             + N'; SET IDENTITY_INSERT dbo.' + QUOTENAME(@t) + N' OFF;';

  EXEC sp_executesql @sql;
  PRINT N'[ins] ' + @t;
  SET @i += 1;
END
DROP TABLE #c;

COMMIT;

/* ── 结果核对 ── */
SELECT 'qc_insp' AS k, COUNT(*) AS n FROM dbo.qc_insp
UNION ALL SELECT 'qc_insp_detail', COUNT(*) FROM dbo.qc_insp_detail
UNION ALL SELECT 'yj_doc_status(QC_INSP)', COUNT(*) FROM dbo.yj_doc_status WHERE panel_code = 'QC_INSP'
UNION ALL SELECT 'yj_form_approval(QC_INSP)', COUNT(*) FROM dbo.yj_form_approval WHERE panel_code = 'QC_INSP'
UNION ALL SELECT 'qc_insp_rec', COUNT(*) FROM dbo.qc_insp_rec
UNION ALL SELECT 'flow_link(QC_INSP 相关)', COUNT(*) FROM dbo.form_flow_link
      WHERE (source_panel_code = 'QC_INSP' AND source_form_no IN (SELECT 单据编号 FROM dbo.qc_insp))
         OR (target_panel_code = 'QC_INSP' AND target_form_no IN (SELECT 单据编号 FROM dbo.qc_insp));
