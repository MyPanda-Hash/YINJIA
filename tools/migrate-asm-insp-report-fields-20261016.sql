/* migrate-asm-insp-report-fields-20261016.sql(2026-10-16)
 * 组装成品检验单(QC_ASM_INSP):① 补报表表头要的 检验时间/抽检总量 ② 去掉 数量/实测数值 两个字段
 *
 * 【用户口径(2026-10-16,截图 = 组装成品检验的导出报表版式)】
 *   「为当前的组装成品检验的导出报表格式为如图所示(检验时间|客户名称|产品编码|型号(mm)|批号|抽检总量|
 *     外观|尺寸|出货重量|结果判断),需要能真实获取明细表中的数据,针对当前不同项目获取格式实现,
 *     然后当前检验单不需要数量字段和实测数据字段,去除当前这两个字段」
 *
 * 【① 补两个表头字段(截图有、本单没有)】
 *   实库实测:`qc_asm_insp_head` 没有 `检验时间`/`抽检总量`(同族的制程检验单 2026-10-12 就有这两列);
 *   报表版式要它们 ⇒ 按制程检验单同口径补列(nvarchar(30) / decimal(18,4)),并登记 yj_field。
 *
 * 【② 去掉 数量 / 实测数值 两个字段】
 *   业务口径:本单不再录「数量」(数量判定自 2026-10-15 起已改为「不合格数量 + 检验数量派生合格数」,
 *   数量列不再参与任何取数)与「实测数值」(改用 测量值1..5 逐格数值 + 产线常规功能性结果)。
 *   做法照本仓先例(`migrate-insp-pass-qty-derived-20261015.sql` 注销「合格数量」字段登记):
 *   **只注销 yj_field 登记行(界面不再出现/不再取数),物理列留作历史**,不动任何一行数据;
 *   列级注明改写为「已停用(仅存历史)」,避免后人以为是漏登记。
 *
 * 【不动】成型/切炭/制程检验单(它们的 数量/实测数值 仍在使用);任何单据行数据。
 * 【幂等】加列 COL_LENGTH 判空、登记 NOT EXISTS、注销 DELETE 带窄条件;两账套(先正式后测试)均执行。
 */

/* ══════════════════ A. 补表头两列(镜像制程检验单) ══════════════════ */
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'检验时间') IS NULL
  ALTER TABLE dbo.qc_asm_insp_head ADD 检验时间 nvarchar(30) NULL;
GO
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'抽检总量') IS NULL
  ALTER TABLE dbo.qc_asm_insp_head ADD 抽检总量 decimal(18,4) NULL;
GO

DECLARE @cmt TABLE (col sysname, note nvarchar(400));
INSERT INTO @cmt VALUES
 (N'检验时间', N'实际取样时刻(可与单据日期/检验日期不同;与制程检验单同口径,2026-10-16 为报表版式补)'),
 (N'抽检总量', N'本批抽检总数量(报表表头列;与制程检验单同口径,2026-10-16 为报表版式补)');
DECLARE @c sysname, @n nvarchar(400);
DECLARE curA CURSOR LOCAL FAST_FORWARD FOR SELECT col, note FROM @cmt;
OPEN curA FETCH NEXT FROM curA INTO @c, @n;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(N'dbo.qc_asm_insp_head', @c) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                      WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_head')
                        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_head'), @c, 'ColumnId')
                        AND name = N'MS_Description' AND class = 1)
    EXEC sp_addextendedproperty N'MS_Description', @n, N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_head', N'COLUMN', @c;
  FETCH NEXT FROM curA INTO @c, @n;
END
CLOSE curA DEALLOCATE curA;
GO

/* yj_field:检验时间(表头,插在 检验日期 之前)/ 抽检总量(表头,插在 检验数量 之前) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'检验时间')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_ASM_INSP', N'检验时间', N'检验时间', N'文本', N'query,header', 145, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'抽检总量')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_ASM_INSP', N'抽检总量', N'抽检总量', N'小数', N'header', 125, 100, 1, 0, 0, 1);
GO

/* 译名(制程检验单那批已落库、按标签全局共享;这里只兜底) */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验时间' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'检验时间', N'en', N'Inspection Time', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'抽检总量' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'抽检总量', N'en', N'Sample Total Qty', N'manual');
GO

/* ══════════════════ B. 注销 数量 / 实测数值 两个字段(物理列留历史) ══════════════════ */
DELETE FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name IN (N'数量', N'实测数值');
PRINT N'[OK] 注销字段登记行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* 列级注明改写为「已停用」,免得后人当成漏登记又给补回去 */
DECLARE @off TABLE (col sysname, note nvarchar(400));
INSERT INTO @off VALUES
 (N'数量',     N'已停用(2026-10-16 用户口径「不需要数量字段」):本单不再录数量 —— 合格数由 表头检验数量 − Σ不合格数量 派生;物理列仅存历史,取数/报表现已不用'),
 (N'实测数值', N'已停用(2026-10-16 用户口径「不需要实测数据字段」):改用 测量值1..5 逐格数值 + 产线常规功能性结果;物理列仅存历史');
DECLARE @c2 sysname, @n2 nvarchar(400);
DECLARE curB CURSOR LOCAL FAST_FORWARD FOR SELECT col, note FROM @off;
OPEN curB FETCH NEXT FROM curB INTO @c2, @n2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(N'dbo.qc_asm_insp_detail', @c2) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_detail'), @c2, 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
      EXEC sp_updateextendedproperty N'MS_Description', @n2, N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_detail', N'COLUMN', @c2;
    ELSE
      EXEC sp_addextendedproperty N'MS_Description', @n2, N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_detail', N'COLUMN', @c2;
  END
  FETCH NEXT FROM curB INTO @c2, @n2;
END
CLOSE curB DEALLOCATE curB;
GO

/* ══════════════════ C. 自检 ══════════════════ */
DECLARE @bad int = 0;
/* C1. 两列补上、两字段注销(物理列仍在,数据不动) */
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'检验时间') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'抽检总量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'数量') IS NULL SET @bad = @bad + 1;      /* 物理列应保留 */
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'实测数值') IS NULL SET @bad = @bad + 1;  /* 同上 */
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name IN (N'数量', N'实测数值')) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'检验时间' AND visible = 1) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'抽检总量' AND visible = 1) SET @bad = @bad + 1;
/* C2. 其它检验单的 实测数值 必须原样保留;数量 在成型/切炭上保留(制程检验单本就没有「数量」字段)
   ⚠ 2026-10-17 修:期望张数按**仍在册的面板**动态算 —— QC_MOLD_INSP / QC_CUT_INSP 两面板
   已随 qc_mold/qc_cut 两表在链上更靠后的 migrate-drop-qc-mold-cut-finspec-20261016.sql 下架,
   写死 3/2 会让本脚本「内容一变就要重跑」时必然 FAIL ⇒ 链断、其后迁移不执行。 */
DECLARE @expMv int = (SELECT COUNT(*) FROM yj_panel
                       WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_PROC_INSP'));
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_PROC_INSP')
      AND col_name = N'实测数值') < @expMv SET @bad = @bad + 1;
DECLARE @expQty int = (SELECT COUNT(*) FROM yj_panel WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP'));
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP')
      AND col_name = N'数量') < @expQty SET @bad = @bad + 1;
/* C3. 明细可见列不撞号 */
IF EXISTS (SELECT 1 FROM yj_field x JOIN yj_field y
             ON y.panel_code = x.panel_code AND y.seq = x.seq AND y.id <> x.id
            WHERE x.panel_code = N'QC_ASM_INSP' AND x.visible = 1 AND x.place LIKE N'%detail%'
              AND y.visible = 1 AND y.place LIKE N'%detail%') SET @bad = @bad + 1;
/* C4. 注明 + 译名 */
IF (SELECT COUNT(*) FROM sys.extended_properties ep
     WHERE ep.major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail')
       AND COL_NAME(ep.major_id, ep.minor_id) IN (N'数量', N'实测数值')
       AND ep.name = N'MS_Description') < 2 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'抽检总量' AND locale = N'en') SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'成品检验单报表字段迁移自检失败(补列/注销/次序/注明/译名)', 16, 1);
ELSE PRINT N'成品检验单报表字段就绪:补 检验时间/抽检总量(表头) + 注销 数量/实测数值 字段登记(物理列留历史)';
GO
