/* ============================================================
   migrate-so-line-no.sql — 2026-09-27 销售订单明细行加「行号」
   ------------------------------------------------------------
   用户拍板:销售订单明细行从上到下自动 1..N 编号,进入订单结转页展示;
   转工单时工单行号(plang.pl_xc)= 订单行号 同值下传。
   先例:bl_pu_order.行号(2026-09-20,金蝶分录 seq,sync-core.mjs PU mapLines);
   本脚本对齐同一口径:
     ① bl_so_order 加 行号 int NULL(同步侧 sync-core.mjs SO mapLines 写入 m.seq);
     ② 存量回填:按 单据编号 分组、id 升序 ROW_NUMBER 1..N(幂等:只填 NULL);
     ③ yj_field 注册 SO_ORDER 明细.行号(seq=5 置首列,克隆 PU_ORDER.行号 行);
   幂等可重跑。 ============================================================ */
SET NOCOUNT ON;
GO
IF COL_LENGTH(N'dbo.bl_so_order', N'行号') IS NULL
    ALTER TABLE dbo.bl_so_order ADD [行号] int NULL;
GO
IF COL_LENGTH(N'dbo.bl_so_order', N'行号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.bl_so_order')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_so_order'), N'行号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'行号(销售订单明细行序,金蝶分录 seq 从 1 连续;订单结转页展示,转工单时作为工单行号 pl_xc 同值下传)',
            N'SCHEMA', N'dbo', N'TABLE', N'bl_so_order', N'COLUMN', N'行号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'行号(销售订单明细行序,金蝶分录 seq 从 1 连续;订单结转页展示,转工单时作为工单行号 pl_xc 同值下传)',
            N'SCHEMA', N'dbo', N'TABLE', N'bl_so_order', N'COLUMN', N'行号';
END
GO
-- 存量回填(幂等:只补 NULL 行;按 单据编号 分组 id 升序 1..N)
UPDATE l SET [行号] = x.rn
FROM dbo.bl_so_order l
JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY 单据编号 ORDER BY id) AS rn
      FROM dbo.bl_so_order) x ON x.id = l.id
WHERE l.[行号] IS NULL;
GO
-- 面板字段注册(SO_ORDER 明细.行号;克隆 PU_ORDER.行号:data_type=文本/detail/seq=5/width=90/只读)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SO_ORDER' AND col_name = N'行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('SO_ORDER', N'行号', N'行号', N'文本', NULL, NULL, NULL, NULL,
            'detail', 5, 90, 0, 0, 0, NULL, 1);
GO
PRINT N'bl_so_order.行号 就绪(列+注明+回填+字段注册,幂等)';
GO
