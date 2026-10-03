/* ============================================================
   migrate-pc-plang-id.sql — 2026-09-28 批次号纯日期化配套
   ------------------------------------------------------------
   客户拍板:批次号=纯日期 yyyyMMdd,不再 -2/-3 尾缀。批次号从"关联键"
   降级为纯展示字段;plang_pc 与 plang 的行级关联改锚 plang_id=plang.id
   (创建顺序,同天多笔转单各自成行互不串;scjl.gd_id→plang_pc.id 链路不变)。
   ① plang_pc 加 plang_id int + 中文注明;
   ② 回填:按 comm+pl_no+pl_xc+批次号 匹配(存量尾缀批次可精确匹配;
      若同键多行按 id 顺序取第一行——历史近似,新数据走 assign 直写)。
   幂等可重跑。 ============================================================ */
SET NOCOUNT ON;
GO
IF COL_LENGTH(N'dbo.plang_pc', N'plang_id') IS NULL
    ALTER TABLE dbo.plang_pc ADD [plang_id] int NULL;
GO
IF COL_LENGTH(N'dbo.plang_pc', N'plang_id') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.plang_pc')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'plang_id', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'工单行锚(plang.id;批次号纯日期化后行级关联主键——同天多笔转单同批次号,靠本列区分)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'plang_id';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'工单行锚(plang.id;批次号纯日期化后行级关联主键——同天多笔转单同批次号,靠本列区分)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'plang_id';
END
GO
-- 回填(幂等:只填 NULL)
UPDATE pc SET pc.plang_id = t.pid
FROM dbo.plang_pc pc
CROSS APPLY (SELECT TOP 1 p.id AS pid FROM dbo.plang p
             WHERE p.comm = pc.comm AND p.pl_no = pc.pl_no AND p.pl_xc = pc.pl_xc
               AND ISNULL(p.[批次号], N'') = ISNULL(pc.[批次号], N'')
             ORDER BY p.id) t
WHERE pc.plang_id IS NULL;
GO
PRINT N'plang_pc.plang_id 就绪(幂等)';
GO
