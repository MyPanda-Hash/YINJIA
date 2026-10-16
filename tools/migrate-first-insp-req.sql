/* ============================================================================
   migrate-first-insp-req.sql(2026-10-16) —— 首件检验单「相关要求」落地(第三轮)
   ----------------------------------------------------------------------------
   用户口径:「这个是针对当前的首件检验单的相关要求内容,查看一下下面所述的各项要求并实现。」

   纸面《相关要求》6 条里,唯一**系统里缺数据**的一条是第 6 条:
     「C-95客户相关产品脱模后立马进行首件检验。」
   C-95 = 客户代码(dm_kh.dm = N'C-95' / 青岛伊可普电器有限公司),不是产品编码;
   而 qc_first_insp_head 上只有「客户名称」(且从来没被写入过),**没有客户代码**
   ⇒ 检验单拿到手也判不出"这是不是 C-95 的单"。本脚本只补这一列(其余 5 条都是版式/校验规则,
   在 QcFirstInspSheet.vue 里落地,不动表结构):
     ① qc_first_insp_head +「客户代码」nvarchar(50);
     ② 列级中文注明(写明来源与用途);
     ③ yj_field 登记(place=query,header —— 与孪生列「客户名称」同口径:可查、可随单保存;
        纸张版式**不打印**它,纸张只渲染固定的那几格);
     ④ 译名:标签「客户代码」全库已有 10 语言(KHDD/OP_TIME/STOCK_STATUS 在用),
        按「同一中文标签全局共享译名」**不重复插**。
   幂等可重跑。
   ============================================================================ */
SET NOCOUNT ON;
GO

IF COL_LENGTH(N'dbo.qc_first_insp_head', N'客户代码') IS NULL
    ALTER TABLE dbo.qc_first_insp_head ADD [客户代码] nvarchar(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.qc_first_insp_head')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_first_insp_head'), N'客户代码', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'客户代码(工单行 plang.khdm → dm_kh.dm;出单时带入。相关要求第 6 条「C-95客户相关产品脱模后立马进行首件检验」以它判定,纸面不打印)',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_first_insp_head', N'COLUMN', N'客户代码';
GO

/* yj_field:seq 66 紧挨「客户名称 65」(同一组客户信息);place 与客户名称一致(query,header) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND col_name = N'客户代码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, width,
                          editable, required, hidden, visible)
    VALUES (N'QC_FIRST_INSP', N'客户代码', N'客户代码', N'文本', NULL, N'query,header', 66, 110, 1, 0, 0, 1);
GO

/* 自检:缺列 / 缺登记 / 缺注明,任一不满足直接报错(不静默成功) */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_first_insp_head', N'客户代码') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND col_name = N'客户代码'
               AND place LIKE N'%header%' AND visible = 1) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.qc_first_insp_head')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_first_insp_head'), N'客户代码', 'ColumnId')
                 AND name = N'MS_Description') SET @bad = @bad + 1;
-- 译名(标签全局共享):缺了才提示,不算失败(全库 10 语言本就有)
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'客户代码') = 0
    PRINT N'[提示] yj_translation 里没有「客户代码」译名(全库本应有 10 语言,请核查)';
IF @bad > 0 RAISERROR(N'首件检验单「客户代码」迁移自检失败(缺列/缺登记/缺注明)', 16, 1);
ELSE PRINT N'首件检验单「客户代码」就绪(qc_first_insp_head.客户代码 + yj_field 登记 + 列级注明)';
GO
