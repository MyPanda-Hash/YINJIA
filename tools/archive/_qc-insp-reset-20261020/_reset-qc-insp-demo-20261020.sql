/* ============================================================
   _reset-qc-insp-demo-20261020.sql — 清理「来料检验单」的演示单/无来源单
   (2026-10-20 用户口径:清理一下来料检验单的数据后重新导入历史提交中的来料检验 excel 表)

   清理口径(用户选定「只删演示/无来源单」):
     qc_insp 里 **暂收单号为空** 的单据 = 88 张演示单(asp_user2='qc-realize-20261018')
     + 11 张手工新增的空草稿 ⇒ 共 99 张;有暂收单号的 17 张真实链路单原样保留。

   连带清理(只针对这 99 张):
     qc_insp_detail 244 行 / yj_doc_status 99 行 / yj_form_approval 88 行 /
     form_flow_link 8 行(源 2 + 目标 6);qc_insp_rec、附件、批注、修改日志均为 0。

   安全:
     · 先按表做整行快照 `_bak_qc_insp_*_20261020`(原样列),导入验收后再 DROP;
     · 目标数必须是 99,否则 RAISERROR 中止(防口径漂移);
     · 全程单事务,失败整体回滚。

   执行(在 tools 目录,UTF-8 无 BOM):
     docker cp tools/archive/_qc-insp-reset-20261020/_reset-qc-insp-demo-20261020.sql mssql2019:/tmp/
     docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P '***' -d HSDZ_MES -C -b -f 65001 -i /tmp/_reset-qc-insp-demo-20261020.sql"

   回滚(未 DROP 备份表时):
     INSERT INTO qc_insp SELECT * FROM _bak_qc_insp_20261020;  …其余四张同理
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('tempdb..#d') IS NOT NULL DROP TABLE #d;
CREATE TABLE #d (no nvarchar(200) NOT NULL PRIMARY KEY);
INSERT INTO #d (no)
SELECT 单据编号 FROM qc_insp WHERE ISNULL(暂收单号, N'') = N'';

DECLARE @target int = (SELECT COUNT(*) FROM #d);
PRINT N'[1] 目标单据(无暂收单号)= ' + CAST(@target AS nvarchar(10)) + N' 张';
IF @target <> 99
BEGIN
  RAISERROR(N'[FAIL] 目标应为 99 张,实际 %d 张 —— 口径已变,先人工核对再执行', 16, 1, @target);
  RETURN;
END

/* ── 2. 整行快照(可回滚) ── */
IF OBJECT_ID('_bak_qc_insp_20261020')          IS NOT NULL DROP TABLE _bak_qc_insp_20261020;
IF OBJECT_ID('_bak_qc_insp_detail_20261020')   IS NOT NULL DROP TABLE _bak_qc_insp_detail_20261020;
IF OBJECT_ID('_bak_qc_insp_status_20261020')   IS NOT NULL DROP TABLE _bak_qc_insp_status_20261020;
IF OBJECT_ID('_bak_qc_insp_approval_20261020') IS NOT NULL DROP TABLE _bak_qc_insp_approval_20261020;
IF OBJECT_ID('_bak_qc_insp_flow_20261020')     IS NOT NULL DROP TABLE _bak_qc_insp_flow_20261020;

SELECT * INTO _bak_qc_insp_20261020
  FROM qc_insp WHERE 单据编号 IN (SELECT no FROM #d);
SELECT * INTO _bak_qc_insp_detail_20261020
  FROM qc_insp_detail WHERE 单据编号 IN (SELECT no FROM #d);
SELECT * INTO _bak_qc_insp_status_20261020
  FROM yj_doc_status WHERE panel_code = 'QC_INSP' AND doc_no IN (SELECT no FROM #d);
SELECT * INTO _bak_qc_insp_approval_20261020
  FROM yj_form_approval WHERE panel_code = 'QC_INSP' AND form_no IN (SELECT no FROM #d);
SELECT * INTO _bak_qc_insp_flow_20261020
  FROM form_flow_link
 WHERE (source_panel_code = 'QC_INSP' AND source_form_no IN (SELECT no FROM #d))
    OR (target_panel_code = 'QC_INSP' AND target_form_no IN (SELECT no FROM #d));

DECLARE @bk1 int = (SELECT COUNT(*) FROM _bak_qc_insp_20261020);
DECLARE @bk2 int = (SELECT COUNT(*) FROM _bak_qc_insp_detail_20261020);
DECLARE @bk3 int = (SELECT COUNT(*) FROM _bak_qc_insp_status_20261020);
DECLARE @bk4 int = (SELECT COUNT(*) FROM _bak_qc_insp_approval_20261020);
DECLARE @bk5 int = (SELECT COUNT(*) FROM _bak_qc_insp_flow_20261020);
PRINT N'[2] 快照: 头 ' + CAST(@bk1 AS nvarchar(10))
    + N' / 明细 ' + CAST(@bk2 AS nvarchar(10))
    + N' / 状态 ' + CAST(@bk3 AS nvarchar(10))
    + N' / 审批 ' + CAST(@bk4 AS nvarchar(10))
    + N' / 链路 ' + CAST(@bk5 AS nvarchar(10));

/* ── 3. 单事务删除 ── */
BEGIN TRAN;

DELETE FROM form_flow_link
 WHERE (source_panel_code = 'QC_INSP' AND source_form_no IN (SELECT no FROM #d))
    OR (target_panel_code = 'QC_INSP' AND target_form_no IN (SELECT no FROM #d));
PRINT N'[3] form_flow_link 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE FROM yj_form_approval WHERE panel_code = 'QC_INSP' AND form_no IN (SELECT no FROM #d);
PRINT N'[4] yj_form_approval 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE FROM yj_doc_status WHERE panel_code = 'QC_INSP' AND doc_no IN (SELECT no FROM #d);
PRINT N'[5] yj_doc_status 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE FROM qc_insp_detail WHERE 单据编号 IN (SELECT no FROM #d);
PRINT N'[6] qc_insp_detail 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE FROM qc_insp WHERE 单据编号 IN (SELECT no FROM #d);
PRINT N'[7] qc_insp 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

COMMIT;

/* ── 4. 收尾核对 ── */
SELECT 'qc_insp 剩余(总)' AS k, COUNT(*) AS n FROM qc_insp
UNION ALL SELECT 'qc_insp 剩余(有暂收单号)', COUNT(*) FROM qc_insp WHERE ISNULL(暂收单号, '') <> ''
UNION ALL SELECT 'qc_insp 剩余(无暂收单号)', COUNT(*) FROM qc_insp WHERE ISNULL(暂收单号, '') = ''
UNION ALL SELECT 'qc_insp_detail 剩余', COUNT(*) FROM qc_insp_detail
UNION ALL SELECT 'yj_doc_status(QC_INSP) 剩余', COUNT(*) FROM yj_doc_status WHERE panel_code = 'QC_INSP'
UNION ALL SELECT 'yj_form_approval(QC_INSP) 剩余', COUNT(*) FROM yj_form_approval WHERE panel_code = 'QC_INSP';
