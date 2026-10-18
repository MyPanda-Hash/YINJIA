-- migrate-qc-insp-clear-11-docstatus-20261018.sql — 清掉 11 张真实来料检验单的残留审核状态(2026-10-18)
--
-- 【用户口径】「把 yj_doc_status 里这 11 条清掉」。
--
-- 【为什么清】这 11 张是「暂收单审核 → 自动生成来料检验单」出来的**真实业务单**,本应停在草稿等业务走流程;
--   但 `yj_doc_status` 里早有一条残留记录(shr=admin、shsj 有值、archived=N) ——
--   界面「审核状态」列与顶部印章读的就是它 ⇒ 显示「已审核」,而 `qc_insp.单据状态` 明明是「草稿」,
--   两边打架,单据也走不了流程。清掉后 `docStatus(null)` 直接返回「草稿」,与表内状态一致。
--
-- 【范围】只清 `panel_code='QC_INSP'` 且单号在下列 11 张白名单内的行:
--   IJ-2026-09-0152 / IJ-2026-10-0011 ~ IJ-2026-10-0020
--   实测关联面:`yj_form_approval` 命中 **0 条**(没有审批留痕要清)、`form_flow_link` 作为来源 1 条(不动,
--   那是暂收单→检验单的流转链,与审核状态无关)。
--
-- 【守卫】① 这 11 张在 qc_insp 里必须仍是「草稿」——若已被业务审过就拒绝执行;
--         ② 命中行数必须正好 11(0 = 已经清过,幂等跳过)。
--
-- 幂等:清完再跑命中 0 行 ⇒ 跳过。两账套都要跑。

SET NOCOUNT ON;

DECLARE @docs TABLE (doc_no nvarchar(60) PRIMARY KEY);
INSERT INTO @docs (doc_no) VALUES
  (N'IJ-2026-09-0152'),
  (N'IJ-2026-10-0011'), (N'IJ-2026-10-0012'), (N'IJ-2026-10-0013'), (N'IJ-2026-10-0014'),
  (N'IJ-2026-10-0015'), (N'IJ-2026-10-0016'), (N'IJ-2026-10-0017'), (N'IJ-2026-10-0018'),
  (N'IJ-2026-10-0019'), (N'IJ-2026-10-0020');

/* ═══ 1. 守卫:白名单里每张都得在 qc_insp 且仍是草稿 ═══ */
DECLARE @missing int = (SELECT COUNT(1) FROM @docs d
                         WHERE NOT EXISTS (SELECT 1 FROM qc_insp h WHERE h.单据编号 = d.doc_no));
IF @missing > 0
BEGIN
    RAISERROR(N'[FAIL] 白名单里有 %d 张单据在 qc_insp 中不存在,先核对单号', 16, 1, @missing);
    RETURN;
END

DECLARE @notDraft int = (SELECT COUNT(1) FROM qc_insp h JOIN @docs d ON d.doc_no = h.单据编号
                          WHERE ISNULL(h.单据状态, N'草稿') <> N'草稿');
IF @notDraft > 0
BEGIN
    RAISERROR(N'[FAIL] 有 %d 张单据已不是草稿(业务已审过),拒绝清状态', 16, 1, @notDraft);
    RETURN;
END

/* ═══ 2. 清 yj_doc_status(只清这 11 张) ═══ */
DECLARE @hit int = (SELECT COUNT(1) FROM yj_doc_status s JOIN @docs d ON d.doc_no = s.doc_no
                     WHERE s.panel_code = N'QC_INSP');
PRINT N'  待清 yj_doc_status 行数 = ' + CAST(@hit AS nvarchar(10));

IF @hit = 0
BEGIN
    PRINT N'  [SKIP] 这 11 张已经没有状态记录(幂等重跑)';
END
ELSE IF @hit <> 11
BEGIN
    RAISERROR(N'[FAIL] 命中行数应为 11,实际 %d,排查是否有额外的状态记录', 16, 1, @hit);
    RETURN;
END
ELSE
BEGIN
    DELETE s FROM yj_doc_status s JOIN @docs d ON d.doc_no = s.doc_no
     WHERE s.panel_code = N'QC_INSP';
    PRINT N'  已清除 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 条残留审核状态';
END

/* ═══ 3. 自检:状态记录归 0,且 qc_insp 仍是草稿;顺手确认 90 张已归档的不受影响 ═══ */
DECLARE @left int = (SELECT COUNT(1) FROM yj_doc_status s JOIN @docs d ON d.doc_no = s.doc_no
                      WHERE s.panel_code = N'QC_INSP');
DECLARE @stillDraft int = (SELECT COUNT(1) FROM qc_insp h JOIN @docs d ON d.doc_no = h.单据编号
                            WHERE ISNULL(h.单据状态, N'草稿') = N'草稿');
DECLARE @archived int = (SELECT COUNT(1) FROM yj_doc_status
                          WHERE panel_code = N'QC_INSP' AND archived = 'Y');
IF @left > 0
BEGIN
    RAISERROR(N'[FAIL] 仍有 %d 条状态记录未清', 16, 1, @left);
    RETURN;
END
IF @stillDraft <> 11
BEGIN
    RAISERROR(N'[FAIL] 应仍为 11 张草稿,实际 %d', 16, 1, @stillDraft);
    RETURN;
END
-- 90 张演示单只在远程库有;本地库没有它们时 @archived=0 属正常(11 张真实单不受影响),
-- 只有「既不是 0 也不是 90」才视为动了别的单,需排查。
IF @archived NOT IN (0, 90)
BEGIN
    RAISERROR(N'[FAIL] 90 张已归档的检验单受了影响(现 %d 张),不要提交,先排查', 16, 1, @archived);
    RETURN;
END

PRINT N'[OK] 11 张真实检验单的残留审核状态已清;它们回到「草稿」可走流程,90 张已归档单未受影响'
PRINT N'     提示:这 11 张仍带 SL-* 暂收单号,流转链(form_flow_link)未动'
