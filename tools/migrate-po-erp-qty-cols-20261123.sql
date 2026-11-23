/* ============================================================================
   采购订单明细:直接显示金蝶的「已入库 / 未入库」数量(2026-11-23)

   背景(用户报障):MES 生单对话框显示「剩余=0(送满了)」,但金蝶采购订单还是「未完成」。
   根因是两边口径不同 —— MES 量的是「已生单占用」,金蝶量的是「已审核入库量」。
   金蝶的行级执行量其实**早就同步进来了**(bl_pu_order.行已执行数量 / 行未执行数量,
   由 deploy/sync-core.mjs 的 EXTRA_LINES 自动映射 in_qty / un_out_qty),
   只是 yj_field 里这两列一直是 visible=0 / hidden=1,界面上看不到。

   本脚本只做「显示层」开口子,**不动任何业务流程、不动表结构**:
     ① yj_field:两列置为表格可见(visible=1),并排到「数量」后面(seq 51/52),
        同时把标签改成业务话术(金蝶已入库数量 / 金蝶未入库数量);
        hidden 保持 1 —— 明细网格按 visible 过滤、纸张按 hidden 过滤,
        这样只进表格,**采购订单打印纸面不变**。
     ② yj_field_view:角色「仓库审核(cksh)」存过显式字段视图(101 行),这两列在里面是
        shown=0;不一起放开,该角色仍然看不到(其余角色/管理员没有显式行,跟随整体)。
     ③ yj_translation:两个新标签补 en 译名(切英语不能还显示中文)。

   幂等:全部是窄条件 UPDATE / 存在性 INSERT,重复执行结果一致。
   两账套:HSDZ_MES(正式)与 HSDZ_MES_TEST(测试)都要执行。
   ========================================================================= */
SET NOCOUNT ON;

DECLARE @note NVARCHAR(200) = N'';

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'PU_ORDER')
BEGIN
    RAISERROR(N'[SKIP] 本账套没有 PU_ORDER 面板,跳过(不视为失败)', 10, 1) WITH NOWAIT;
END
ELSE
BEGIN
    /* ── ① 两列进明细表格(只改 visible,hidden 保持原值 1 = 纸张不印) ───────── */
    UPDATE yj_field
       SET visible = 1,
           seq     = 51,
           width   = 110,
           label   = N'金蝶已入库数量'
     WHERE panel_code = N'PU_ORDER'
       AND place      = N'detail'
       AND col_name   = N'行已执行数量';

    UPDATE yj_field
       SET visible = 1,
           seq     = 52,
           width   = 110,
           label   = N'金蝶未入库数量'
     WHERE panel_code = N'PU_ORDER'
       AND place      = N'detail'
       AND col_name   = N'行未执行数量';

    /* ── ② 角色显式视图(cksh)同步放开 ───────────────────────────────────── */
    IF OBJECT_ID(N'dbo.yj_field_view') IS NOT NULL
    BEGIN
        UPDATE yj_field_view
           SET shown = 1, seq = 51, operator = N'migrate-po-erp-qty-20261123', updated_at = SYSDATETIME()
         WHERE panel_code = N'PU_ORDER' AND place_kind = N'detail' AND col_name = N'行已执行数量';

        UPDATE yj_field_view
           SET shown = 1, seq = 52, operator = N'migrate-po-erp-qty-20261123', updated_at = SYSDATETIME()
         WHERE panel_code = N'PU_ORDER' AND place_kind = N'detail' AND col_name = N'行未执行数量';
    END
    ELSE
        SET @note = @note + N'yj_field_view 不存在;';

    /* ── ③ 新标签的译名(切英语不能显示中文) ─────────────────────────────── */
    IF OBJECT_ID(N'dbo.yj_translation') IS NULL
        SET @note = @note + N'yj_translation 不存在;';
    ELSE
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'金蝶已入库数量' AND locale = 'en')
            INSERT INTO yj_translation (scope, ref_key, locale, text, source)
            VALUES (N'field', N'金蝶已入库数量', 'en', N'Kingdee Received Qty', 'manual');

        IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'金蝶未入库数量' AND locale = 'en')
            INSERT INTO yj_translation (scope, ref_key, locale, text, source)
            VALUES (N'field', N'金蝶未入库数量', 'en', N'Kingdee Unreceived Qty', 'manual');
    END

    /* ── ④ 自检(三态:不存在 / 未改成功 / 通过) ───────────────────────────── */
    DECLARE @f1 INT = (SELECT COUNT(*) FROM yj_field
                        WHERE panel_code = N'PU_ORDER' AND place = N'detail' AND col_name = N'行已执行数量');
    DECLARE @f2 INT = (SELECT COUNT(*) FROM yj_field
                        WHERE panel_code = N'PU_ORDER' AND place = N'detail' AND col_name = N'行未执行数量');
    DECLARE @ok1 INT = (SELECT COUNT(*) FROM yj_field
                         WHERE panel_code = N'PU_ORDER' AND place = N'detail' AND col_name = N'行已执行数量'
                           AND visible = 1 AND label = N'金蝶已入库数量');
    DECLARE @ok2 INT = (SELECT COUNT(*) FROM yj_field
                         WHERE panel_code = N'PU_ORDER' AND place = N'detail' AND col_name = N'行未执行数量'
                           AND visible = 1 AND label = N'金蝶未入库数量');

    IF @f1 = 0 OR @f2 = 0
        RAISERROR(N'[WARN] PU_ORDER 明细里没找到 行已执行数量(%d)/行未执行数量(%d) 字段注册,本账套结构可能较旧', 10, 1, @f1, @f2) WITH NOWAIT;

    IF @f1 > 0 AND @ok1 = 0
        RAISERROR(N'[FAIL] 金蝶已入库数量 未能置为可见(字段存在但更新未生效)', 16, 1) WITH NOWAIT;

    IF @f2 > 0 AND @ok2 = 0
        RAISERROR(N'[FAIL] 金蝶未入库数量 未能置为可见(字段存在但更新未生效)', 16, 1) WITH NOWAIT;

    IF @note <> N''
        RAISERROR(N'[WARN] 部分对象不存在,已跳过:%s', 10, 1, @note) WITH NOWAIT;

    IF @ok1 > 0 AND @ok2 > 0
        RAISERROR(N'[OK] 采购订单明细已显示「金蝶已入库数量 / 金蝶未入库数量」(visible=1,纸张不印)', 10, 1) WITH NOWAIT;
END
