/* ============================================================
   migrate-wo-pick-return-cleanup-20261030.sql — 清理「空退料单」遗留脏数据

   ⚠ 本脚本**只处理确定是脏数据**的行,不做任何有损的猜测。

   ------------------------------------------------------------
   ★ 背景(用户 2026-10-30 报障:「未完成为什么又含退料」)
   ------------------------------------------------------------
   本功能的退料口径改过两次:
     ① 第一版:扫工单生单时,就**预建一张数量全 0 的退料单草稿**,并把单号写进
        `wo_pick_doc.退料单号`;不做退料就在提交时整单作废;
     ② 第二版(现行):退料**不再预生成**,点开已完成的领料单扫码退,退多少生多少。

   第一版留下的残留:`wo_pick_doc.退料单号` 还写着那批空退料单的单号(如 OI-2026-10-0005),
   而那张单早已作废。于是**未完成**的领料单在界面上顶着「含退料」徽标 —— 与事实不符。

   ------------------------------------------------------------
   ★ 清理判据(必须是"空退料单"才清)
   ------------------------------------------------------------
   一张退料单算"空",当且仅当:
     · 它已作废(asp_cancel='Y' 或 yj_doc_status.canceled='Y'),**或**
     · 它的所有明细数量都是 0;
   且 **在退料台账 wo_pick_return 里没有任何有效记录**(有记录说明真退过料,一律不动)。

   然后把这些单号从 `wo_pick_doc.退料单号` 里剔除:
     · 剔除后为空 → 置 NULL(界面不再显示「含退料」);
     · 还剩别的单号 → 只保留剩下的。

   ------------------------------------------------------------
   ★ 界面侧同时加了一道判据
   ------------------------------------------------------------
   前端「含退料」徽标现在要求**单据必须已完成**(退料本来就只能发生在提交之后),
   所以即使某条脏数据漏清,未完成的单也不会再显示徽标。

   幂等:反复执行结果一致。两账套都执行,已登记 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ---------- ① 先把台账里那些"空退料单"的单号摘出来 ---------- */
DECLARE @empty TABLE (no nvarchar(60) PRIMARY KEY);

-- 已作废的退料单
INSERT INTO @empty (no)
SELECT h.单据编号
  FROM dbo.bd_other_in h
 WHERE h.业务类型 = N'生产退料'
   AND (ISNULL(h.asp_cancel,'N') = 'Y'
        OR EXISTS (SELECT 1 FROM dbo.yj_doc_status s
                    WHERE s.panel_code = N'OTHER_IN' AND s.doc_no = h.单据编号 AND s.canceled = 'Y'))
   -- 台账里没有有效退料记录(有记录 = 真退过料,不算空单)
   AND NOT EXISTS (SELECT 1 FROM dbo.wo_pick_return r
                    WHERE r.退料单号 = h.单据编号 AND ISNULL(r.asp_cancel,'N') <> 'Y')
   AND NOT EXISTS (SELECT 1 FROM @empty);

-- 未作废但所有明细数量都是 0 的退料单
INSERT INTO @empty (no)
SELECT h.单据编号
  FROM dbo.bd_other_in h
 WHERE h.业务类型 = N'生产退料'
   AND ISNULL(h.asp_cancel,'N') <> 'Y'
   AND NOT EXISTS (SELECT 1 FROM dbo.bl_other_in l
                    WHERE l.单据编号 = h.单据编号
                      AND ISNULL(l.asp_cancel,'N') <> 'Y'
                      AND ISNULL(l.数量,0) <> 0)
   AND NOT EXISTS (SELECT 1 FROM dbo.wo_pick_return r
                    WHERE r.退料单号 = h.单据编号 AND ISNULL(r.asp_cancel,'N') <> 'Y')
   AND NOT EXISTS (SELECT 1 FROM @empty e WHERE e.no = h.单据编号);

/* ---------- ② 把空单号从 wo_pick_doc.退料单号 里剔除 ----------
   ⚠ 两个账套的兼容级别都是 100(SQL Server 2008 口径)⇒ **没有 STRING_SPLIT**(2016+ 才有),
     只能手写循环按逗号拆。同理也别用 STRING_AGG/TRY_CAST 之类的新函数。 */
DECLARE @id int, @cur nvarchar(60), @rest nvarchar(400), @part nvarchar(60), @new nvarchar(400);
DECLARE @changed int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT id, 退料单号 FROM dbo.wo_pick_doc WHERE ISNULL(退料单号,'') <> '';
OPEN cur;
FETCH NEXT FROM cur INTO @id, @cur;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @rest = @cur;
    SET @new = N'';
    -- 逐个取逗号前的片段:中英文逗号都当分隔符
    WHILE LEN(@rest) > 0
    BEGIN
        DECLARE @posA int = CHARINDEX(N',', @rest);
        DECLARE @posB int = CHARINDEX(N'，', @rest);
        DECLARE @pos int = CASE
            WHEN @posA = 0 THEN @posB
            WHEN @posB = 0 THEN @posA
            ELSE CASE WHEN @posA < @posB THEN @posA ELSE @posB END END;
        IF @pos = 0
        BEGIN
            SET @part = @rest;
            SET @rest = N'';
        END
        ELSE
        BEGIN
            SET @part = LEFT(@rest, @pos - 1);
            SET @rest = SUBSTRING(@rest, @pos + 1, LEN(@rest));
        END
        SET @part = LTRIM(RTRIM(@part));
        IF @part <> N''
           AND NOT EXISTS (SELECT 1 FROM @empty e WHERE e.no = @part)
        BEGIN
            SET @new = @new + CASE WHEN @new = N'' THEN N'' ELSE N',' END + @part;
        END
    END
    SET @new = NULLIF(@new, N'');
    IF ISNULL(@new, N'') <> ISNULL(@cur, N'')
    BEGIN
        UPDATE dbo.wo_pick_doc SET 退料单号 = @new, asp_user2 = N'migration', asp_time2 = SYSDATETIME()
         WHERE id = @id;
        SET @changed = @changed + 1;
    END
    FETCH NEXT FROM cur INTO @id, @cur;
END
CLOSE cur; DEALLOCATE cur;

DECLARE @emptyCnt int = (SELECT COUNT(*) FROM @empty);
PRINT N'[清理] 识别为空退料单 ' + CAST(@emptyCnt AS nvarchar(10))
    + N' 张;台账 wo_pick_doc 修正 ' + CAST(@changed AS nvarchar(10)) + N' 行';
GO

/* ---------- ③ 自检:未完成的单不得再挂着退料单号 ---------- */
DECLARE @bad int;
SELECT @bad = COUNT(*) FROM dbo.wo_pick_doc
 WHERE 状态 <> N'已完成' AND ISNULL(退料单号, N'') <> N'';

IF @bad > 0
   RAISERROR(N'[WARN] 仍有 %d 张未完成单据挂着退料单号(可能是非空退料单),请人工核对', 16, 1, @bad)
ELSE
   PRINT N'[PASS] 未完成单据均无退料单号残留';
GO
