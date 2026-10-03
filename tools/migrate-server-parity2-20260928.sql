/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-server-parity2-20260928.sql — 服务器直改结构对齐(第二轮)
   来源:2026-09-28 23:20 服务器最新 bak 还原本地分身(补齐 v2 链 14 条后)与本地正式库
   逐列对比;滤除 RENAME_*、bak、tmp 噪音后,真·服务器独有仅 1 列:
     bd_material_out.工单行号 int(服务器侧直加,领料出库关联工单行号语义,与 plang.pl_xc 同义)。
   另 30 列同名不同型(bl_dispatch 派工数量组 char/decimal vs nvarchar/float 等)为
   第一轮已记录的参考库形状漂移,维持双方各跑、不强改类型(见 migrate-server-parity-20260928.sql 注)。
   幂等:守卫式补列+注明;在服务器上执行=列已存在全跳过 no-op,仅登记哈希。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
GO
IF OBJECT_ID('dbo.bd_material_out') IS NOT NULL AND COL_LENGTH('dbo.bd_material_out', N'工单行号') IS NULL
    ALTER TABLE dbo.bd_material_out ADD [工单行号] int NULL;
GO
IF OBJECT_ID('dbo.bd_material_out') IS NOT NULL AND COL_LENGTH('dbo.bd_material_out', N'工单行号') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
    WHERE ep.major_id = OBJECT_ID('dbo.bd_material_out')
      AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bd_material_out'), N'工单行号', 'ColumnId')
      AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工单行号(2026-09-28 服务器侧直加,随第一轮 parity 对齐入链;领料出库关联生产工单行,与 plang.pl_xc 同义)',
        N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'工单行号';
GO
PRINT N'migrate-server-parity2-20260928 完成(守卫式补列+注明,重跑安全)';
GO
