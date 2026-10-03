/* ============================================================
   migrate-material-out-line-no.sql — 2026-10-14 材料出库单(领料)明细行加「行号」
   ------------------------------------------------------------
   用户拍板:行号字段规则参考销售订单(bl_so_order.行号,2026-09-27)。
   本脚本对齐同一口径:
     ① bl_material_out 加 行号 int NULL(行序 1..N;转领料/生成领料单按 BOM 展开序写入);
     ② 存量回填:按 单据编号 分组、id 升序 ROW_NUMBER 1..N(幂等:只填 NULL);
     ③ yj_field 注册 MATERIAL_OUT 明细.行号(seq=5 置首列,克隆 SO_ORDER.行号 行:
        文本/只读/width=90);
     ④ 译名 'field'/'行号' 全语言已有存量(9 locale,deploy-all 种子),无需重复插入。
   幂等可重跑。 ============================================================ */
SET NOCOUNT ON;
GO
IF COL_LENGTH(N'dbo.bl_material_out', N'行号') IS NULL
    ALTER TABLE dbo.bl_material_out ADD [行号] int NULL;
GO
IF COL_LENGTH(N'dbo.bl_material_out', N'行号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.bl_material_out')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'行号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'行号(材料出库单·领料明细行序,从 1 连续;转领料/生成领料单按默认 BOM 展开顺序写入,面板明细首列展示)',
            N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'行号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'行号(材料出库单·领料明细行序,从 1 连续;转领料/生成领料单按默认 BOM 展开顺序写入,面板明细首列展示)',
            N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'行号';
END
GO
-- 存量回填(幂等:只补 NULL 行;按 单据编号 分组 id 升序 1..N)
UPDATE l SET [行号] = x.rn
FROM dbo.bl_material_out l
JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY 单据编号 ORDER BY id) AS rn
      FROM dbo.bl_material_out) x ON x.id = l.id
WHERE l.[行号] IS NULL;
GO
-- 面板字段注册(MATERIAL_OUT 明细.行号;克隆 SO_ORDER.行号:data_type=文本/detail/seq=5 置首列/width=90/只读)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MATERIAL_OUT' AND col_name = N'行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('MATERIAL_OUT', N'行号', N'行号', N'文本', NULL, NULL, NULL, NULL,
            'detail', 5, 90, 0, 0, 0, NULL, 1);
GO
PRINT N'bl_material_out.行号 就绪(列+注明+回填+字段注册,幂等)';
GO
