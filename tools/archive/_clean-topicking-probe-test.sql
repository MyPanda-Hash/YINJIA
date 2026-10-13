/* ============================================================
   _clean-topicking-probe-test.sql — 清理「转领料单按行」探针在**测试账套**造的领料单
   (⚠ 只允许在 HSDZ_MES_TEST 执行,脚本内有 DB_NAME() 守卫)

   背景:tools/archive/_verify-topicking-by-row.mjs 在测试账套对 fixture **MO-2026-09-0007**
   转领料单(该单有 3 个物理行、2 个标识:行1 与 行2)。探针自带界面「删除」,
   但**「删除」按钮只写 yj_doc_status.canceled,不写业务表 asp_cancel** ⇒ 反复跑回归会留下
   存活草稿,下一次跑就被「该工单行已有未审核领料单」守卫挡住(实测踩到)。
   本脚本按 fixture 精确圈定把业务表软删补齐(幂等,可反复跑)。

   正式库的同款清理是 tools/archive/_clean-topicking-probe.sql(单号白名单 CL-2026-10-0009~0015,
   那是 GD-2026-10-0002 的验证产物,两者不要混用)。
   ============================================================ */
SET NOCOUNT ON;
GO
DECLARE @db sysname = DB_NAME();
IF @db <> N'HSDZ_MES_TEST'
BEGIN
    RAISERROR(N'本脚本只允许在测试账套 HSDZ_MES_TEST 执行(当前 %s),已中止', 16, 1, @db);
    RETURN;
END
GO
DECLARE @wo nvarchar(30) = N'MO-2026-09-0007';
DECLARE @docs TABLE (no nvarchar(30) PRIMARY KEY);
-- ⚠ 只圈**探针造的**单:探针按「工单号+工单行号」出单 ⇒ 单头必有 工单行号 > 0;
--   而该 fixture 上**预先存在**的老单是**整单级**(工单行号 = 0/NULL,如 CL-2026-10-0001,
--   2026-10-07 就在库里) —— 必须排除,否则清理会误伤既有单据
--   (2026-10-15 实测踩到:首版没排除,把 CL-2026-10-0001 一起作废了,已复位)。
INSERT INTO @docs (no)
SELECT h.[单据编号] FROM dbo.bd_material_out h
 WHERE ISNULL(h.[加工单号],N'') = @wo
   AND ISNULL(h.[工单行号], 0) > 0
   AND ISNULL(h.asp_cancel,'N') <> 'Y';
DECLARE @n int = (SELECT COUNT(*) FROM @docs);
IF @n = 0 BEGIN PRINT N'无待清理的探针领料单(已清理过)'; END
ELSE
BEGIN
    DECLARE @list nvarchar(400) = (SELECT STRING_AGG(no, N',') FROM @docs);
    PRINT N'待清理探针领料单 ' + CAST(@n AS nvarchar(10)) + N' 张:' + ISNULL(@list, N'');
    -- ① 释放占用链(PLANG → MATERIAL_OUT)
    UPDATE dbo.form_flow_link SET link_status='RELEASED', release_time=SYSDATETIME()
     WHERE target_panel_code='MATERIAL_OUT' AND target_form_no IN (SELECT no FROM @docs)
       AND link_status='ACTIVE';
    -- ② 单据状态作废
    UPDATE s SET s.canceled='Y', s.update_at=GETDATE() FROM dbo.yj_doc_status s
     WHERE s.panel_code='MATERIAL_OUT' AND s.doc_no IN (SELECT no FROM @docs);
    -- ③ 业务表软删(头 + 行)
    UPDATE l SET l.asp_cancel='Y', l.asp_user2=N'probe-cleanup', l.asp_time2=GETDATE()
      FROM dbo.bl_material_out l WHERE l.单据编号 IN (SELECT no FROM @docs) AND ISNULL(l.asp_cancel,'N') <> 'Y';
    UPDATE h SET h.asp_cancel='Y', h.asp_user2=N'probe-cleanup', h.asp_time2=GETDATE()
      FROM dbo.bd_material_out h WHERE h.[单据编号] IN (SELECT no FROM @docs);
    -- ④ 回填列复位(工单行领料单号)
    UPDATE dbo.plang SET ll_no2 = NULL WHERE pl_no = @wo AND ISNULL(ll_no2, N'') <> N''
      AND NOT EXISTS (SELECT 1 FROM dbo.bd_material_out h
                      WHERE ISNULL(h.[加工单号],N'') = @wo AND ISNULL(h.asp_cancel,'N') <> 'Y');
    PRINT N'✅ 已清理(占用链释放 + 领料单软删 + ll_no2 复位)';
END
GO
