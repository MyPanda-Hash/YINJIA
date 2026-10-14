/* ============================================================
   _clean-topicking-probe.sql — 清理 2026-10-15 探针在**正式库**造的领料单草稿
   (仅 CL-2026-10-0009 ~ CL-2026-10-0015 这 7 张,按单号精确圈定;不碰任何既有单据)

   为什么必须清:正式库(HSDZ_MES)只录真实业务;这 7 张是「转领料单按行」修复的验证产物,
   不是业务单据。清理口径 = 与界面「删除」一致(软删 + 状态作废 + 释放占用链),不物理删除。
   用法(tools/ 下):
     java -cp lib\mssql-jdbc.jar SqlRunner.java "<jdbcUrl HSDZ_MES>" yinjia env archive\_clean-topicking-probe.sql
   ============================================================ */
SET NOCOUNT ON;
DECLARE @from nvarchar(30) = N'CL-2026-10-0009', @to nvarchar(30) = N'CL-2026-10-0015';

-- 守卫:只允许清理这 7 张**由本探针创建**的草稿(创建人 admin 且未审核);命中数不符即中止
DECLARE @n int = (SELECT COUNT(*) FROM dbo.bd_material_out h
                  WHERE h.[单据编号] BETWEEN @from AND @to
                    AND ISNULL(h.asp_cancel,'N') <> 'Y'
                    AND ISNULL(h.[加工单号],N'') = N'GD-2026-10-0002'
                    AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='MATERIAL_OUT'
                          AND s.doc_no = h.[单据编号] AND s.shr IS NOT NULL));
IF @n <> 7
BEGIN
    RAISERROR(N'待清理单据数 = %d(期望 7),已中止(防误删)', 16, 1, @n);
    RETURN;
END

-- ① 释放占用链(与 ButtonService 删除下游单同口径)
UPDATE l SET l.link_status = 'RELEASED'
FROM dbo.form_flow_link l
WHERE l.source_panel_code = 'PLANG' AND l.target_panel_code = 'MATERIAL_OUT'
  AND l.target_form_no BETWEEN @from AND @to AND l.link_status = 'ACTIVE';

-- ② 状态行作废(界面「删除」的落点)
UPDATE s SET s.canceled = 'Y', s.update_at = GETDATE()
FROM dbo.yj_doc_status s
WHERE s.panel_code = 'MATERIAL_OUT' AND s.doc_no BETWEEN @from AND @to;

-- ③ 业务表软删(留痕,不物理删)
UPDATE h SET h.asp_cancel = 'Y', h.asp_user2 = N'probe-cleanup', h.asp_time2 = GETDATE()
FROM dbo.bd_material_out h WHERE h.[单据编号] BETWEEN @from AND @to;

PRINT N'探针草稿已清理(7 张:软删 + 状态作废 + 释放占用链)';
SELECT [单据编号], [工单行号], ISNULL(asp_cancel,'N') AS 作废 FROM dbo.bd_material_out
WHERE [单据编号] BETWEEN @from AND @to ORDER BY [单据编号];
