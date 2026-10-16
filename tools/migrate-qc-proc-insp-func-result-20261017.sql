/* migrate-qc-proc-insp-func-result-20261017.sql(2026-10-17):制程检验单明细加「产线常规功能性结果」列。
 *
 * 用户口径(2026-10-17,纸面形式第六次收敛):
 *   「好的当前制程检验形式错误了,这个内容进行修改实现,当前这个修改一下内容实现,不需要那些外观什么的」
 *   + 截图《生产相关品质检验.xlsx》制程检验页签**第二块(出货检验功能性测试组)**:
 *     表头 = 客户名称|产品编码|型号（mm）|批号|**[检验人员： + 以下检验要求自动填充出货检验计划表 /
 *     以下检验方法自动填充出货检验计划表]**|产线常规功能性结果|结果判断,表体 = 一行一个检验项目。
 *   ⇒ 纸张表从"表区分组横表(外观/尺寸/出货重量)"改成**纵向表**(一行一个检验项目);
 *     其中「产线常规功能性结果」是截图里的新列 —— 本脚本把它补给制程检验单明细
 *     (成品检验单 QC_ASM_INSP 已由 migrate-asm-insp-func-test-20261016.sql 加过同名同型列,此处镜像同款)。
 *
 * 本脚本:qc_proc_insp_detail +1 列 `产线常规功能性结果` nvarchar(200) NULL + 列级中文注明 +
 *   yj_field 登记(place=detail / seq **98**,紧跟 不良数量(95) 落在 结果判断(100) 之前,照截图列序 /
 *   **visible=1、hidden=0 = 可编辑可见**) + 该标签缺的语言译名(en 已由成品检验单那批落库,
 *   按「同一中文标签全局共享译名」只补缺)。**不回填**(新列;存量行留空 = 老单据照旧)。
 *
 * ⚠ 2026-10-17 审查修正:yj_field 的 visible 原写成 **0**(镜像来源 migrate-asm-insp-func-test-20261016.sql
 *   对同一标签写的是 1),而明细列在列表页由 visible 过滤(PanelConfigService gridTabs)⇒ 该列不显示;
 *   INSERT 与 ELSE 两分支已一并改为 1,并在自检里卡死。改脚本字节 ⇒ DbSync 按内容哈希重跑本脚本
 *   (幂等,走 ELSE 分支即可收敛)。
 *
 * 规范:列名中文即语义;幂等(COL_LENGTH 判空再 ADD);两账套均执行(先正式后测试)。
 */

/* ============ A. 加列 ============ */
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'产线常规功能性结果') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 产线常规功能性结果 nvarchar(200) NULL;
GO

/* ============ B. 列级中文注明 ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'产线常规功能性结果', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
       N'该检验项目在生产线上做的常规功能性测试结果(纸面「产线常规功能性结果」列;与成品检验单同名同型列)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_detail', N'COLUMN', N'产线常规功能性结果';
GO

/* ============ C. yj_field 登记(place=detail;seq 98 = 不良数量 95 与 结果判断 100 之间) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'产线常规功能性结果')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_PROC_INSP', N'产线常规功能性结果', N'产线常规功能性结果', N'文本', N'detail', 98, 140, 1, 0, 0, 1);
ELSE
  UPDATE yj_field SET data_type = N'文本', place = N'detail', seq = 98, width = 140, editable = 1, hidden = 0, visible = 1
   WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'产线常规功能性结果';
GO

/* ============ D. 多语言(该标签 en 已存在;补齐其余语言) ============ */
DECLARE @t TABLE (locale nvarchar(10), text nvarchar(120));
INSERT INTO @t (locale, text) VALUES
  (N'en', N'Line Routine Functional Result'), (N'ja', N'生産ライン定常機能結果'), (N'ko', N'라인 정규 기능 결과'),
  (N'de', N'Ergebnis der Routinetests'), (N'es', N'Resultado funcional de rutina'), (N'fr', N'Résultat fonctionnel de routine'),
  (N'ru', N'Результат штатного функционального теста'), (N'th', N'ผลทดสอบการทำงานตามปกติ'), (N'vi', N'Kết quả chức năng thường quy'),
  (N'zh-TW', N'產線常規功能性結果');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', N'产线常规功能性结果', t.locale, t.text, N'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = N'field' AND x.ref_key = N'产线常规功能性结果' AND x.locale = t.locale);
GO

/* ============ E. 自检 ============ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'产线常规功能性结果') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'产线常规功能性结果') <> 1 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'产线常规功能性结果') < 9 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'产线常规功能性结果', 'ColumnId')
      AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
/* 列序自检:同面板 detail 里 seq 不能撞号(同 seq 只能按 id 兜底排序) */
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND place LIKE N'%detail%' AND seq = 98
            GROUP BY seq HAVING COUNT(*) > 1) SET @bad = @bad + 1;
/* 可见性自检(2026-10-17 审查修):明细列的可见性判据是 `visible`(PanelConfigService gridTabs 按它过滤),
   本脚本原先 INSERT 写 visible = 0 ⇒ 该列在列表页明细表里**不显示**,与台账「可编辑可见」及镜像来源
   migrate-asm-insp-func-test-20261016.sql(同一标签写 visible = 1)都不一致;卡死它别再被刷回 0。 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP'
                AND col_name = N'产线常规功能性结果' AND visible = 1 AND hidden = 0) SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验单「产线常规功能性结果」迁移自检失败', 16, 1);
ELSE PRINT N'制程检验单「产线常规功能性结果」就绪(列 + 注明 + 字段登记 seq 98 + 语言译名)';
GO
