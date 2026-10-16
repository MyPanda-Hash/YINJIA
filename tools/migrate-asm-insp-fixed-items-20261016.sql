/* migrate-asm-insp-fixed-items-20261016.sql(2026-10-16)
 * 组装成品检验单:① 新增「检验结果」文本列 ② yj_panel.config 声明固定检验项(外观组 端盖两头/管身两侧)
 *
 * 【用户口径(2026-10-16,截图 = 该单报表的 外观/尺寸/出货重量 三组)】
 *   「当前成品检验中这三个检验是固定的需要如何将他们带入进去,让他们能够实现对应的实现?帮我设计一下」
 *   → 拍板三项:① 只做「报表 + 固定项带入」,面板仍用通用明细表(不做纸张表);
 *              ② **新增「检验结果」文本列**承载定性观测值(无异常/异常…);
 *              ③ 固定项**用按钮带入成真明细行**(不自动预铺、也不是只显示不落库)。
 *
 * 【① 为什么补「检验结果」列】
 *   截图里外观格的值是「无异常」这类**定性文本**,而本单在 2026-10-16 已按用户口径注销了 `实测数值`
 *   (migrate-asm-insp-report-fields-20261016.sql),剩下的可填列只有:测量值1..5(数值)、
 *   结果判断(合格/不合格)、产线常规功能性结果(功能性组专用)⇒ **没有地方存"无异常"**。
 *   本列专放定性观测值;数值仍走 测量值1..5,判定仍走 结果判断 —— 三者各司其职。
 *
 * 【② 为什么把固定项写进 yj_panel.config】
 *   「外观」组的 端盖两头/管身两侧 是**全产品通用**的检查点,不来自出货检验计划表(那张是按产品来的),
 *   但报表要照截图**永远铺出这两列**。声明式做法(与 uniqueKeys 同一条规矩):
 *     报表(QcAsmInspReportSupport)先铺固定项、再并数据行(同名按「去表区前缀」归一化去重);
 *     前端(PanelConfigService 下发 metadata.fixedItems)据此把「带入固定检验项」按钮做成落行动作。
 *   加/改固定项 = 改这一行 JSON,不加代码、不动表结构。**QC_PROC_INSP 不写**(用户 2026-10-17 已把
 *   它的外观分组拿掉:"不需要那些外观什么的")。
 *
 * 【幂等】加列 COL_LENGTH 判空;config 用「为空才写 / 已有 fixedItems 就不动」守卫(不覆盖别人写的配置);
 *   两账套(先正式后测试)均执行。
 */

/* ══════════════════ A. 加列:检验结果 nvarchar(200) ══════════════════ */
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'检验结果') IS NULL
  ALTER TABLE dbo.qc_asm_insp_detail ADD 检验结果 nvarchar(200) NULL;
GO
/* ⚠ sp_addextendedproperty 的参数**只能是字面量或变量,不能写表达式**(写成 N'甲'+N'乙' 会报
   `Incorrect syntax near '+'`)—— 先把长注释拼进变量再 EXEC(2026-10-16 第二次踩到,与
   migrate-asm-insp-verdict-rename-20261016.sql 同款)。 */
DECLARE @cmt nvarchar(400) = N'检验结果(定位性观测值,如 外观类的 无异常/异常;数值走 测量值1..5、判定走 结果判断。'
  + N'2026-10-16 为报表「外观」组的格子补,见 yj_panel.config 的 fixedItems)';
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'检验结果') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                    WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail')
                      AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_detail'), N'检验结果', 'ColumnId')
                      AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo',
       N'TABLE', N'qc_asm_insp_detail', N'COLUMN', N'检验结果';
GO

/* yj_field 登记:明细可编辑可见;seq 夹在 检验方法(30)与 测量值1(50)之间 ⇒ 40 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'检验结果')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_ASM_INSP', N'检验结果', N'检验结果', N'文本', N'detail', 40, 140, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验结果' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'检验结果', N'en', N'Inspection Result', N'manual');
GO

/* ══════════════════ B. yj_panel.config 声明固定检验项 ══════════════════ */
/* 只在 config 为空或没有 fixedItems 时写(不覆盖别人写进去的 singleDoc/uniqueKeys 等) */
UPDATE yj_panel
   SET config = N'{"fixedItems":[{"group":"外观","items":["端盖两头","管身两侧"]}]}'
 WHERE panel_code = N'QC_ASM_INSP'
   AND (config IS NULL OR LTRIM(RTRIM(CONVERT(nvarchar(max), config))) = N'' OR CONVERT(nvarchar(max), config) NOT LIKE N'%fixedItems%');
PRINT N'[OK] QC_ASM_INSP 的 fixedItems 声明行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ══════════════════ C. 自检 ══════════════════ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'检验结果') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'检验结果'
                 AND place = N'detail' AND visible = 1 AND hidden = 0) SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties ep
     WHERE ep.major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail')
       AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_detail'), N'检验结果', 'ColumnId')
       AND ep.name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验结果' AND locale = N'en') SET @bad = @bad + 1;
/* 固定项声明:两道关键词都要在(顺序/写法变了也不至于漏判) */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_ASM_INSP'
                 AND CONVERT(nvarchar(max), config) LIKE N'%fixedItems%'
                 AND CONVERT(nvarchar(max), config) LIKE N'%端盖两头%'
                 AND CONVERT(nvarchar(max), config) LIKE N'%管身两侧%') SET @bad = @bad + 1;
/* 明细可见列不撞号 */
IF EXISTS (SELECT 1 FROM yj_field x JOIN yj_field y
             ON y.panel_code = x.panel_code AND y.seq = x.seq AND y.id <> x.id
            WHERE x.panel_code = N'QC_ASM_INSP' AND x.visible = 1 AND x.place LIKE N'%detail%'
              AND y.visible = 1 AND y.place LIKE N'%detail%') SET @bad = @bad + 1;
/* 制程检验单不该被写入 fixedItems(用户已把它的外观分组拿掉) */
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_PROC_INSP'
             AND CONVERT(nvarchar(max), config) LIKE N'%fixedItems%') SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'成品检验单「检验结果列 + 固定检验项声明」迁移自检失败', 16, 1);
ELSE PRINT N'成品检验单固定检验项就绪:检验结果 列 + yj_panel.config 的 fixedItems(外观:端盖两头/管身两侧)';
GO
