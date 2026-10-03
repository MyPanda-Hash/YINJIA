-- migrate-rd-specdoc-prodno-2026-09-30.sql
-- 规格书 RD_SPEC_DOC:「编号」字段正式改名为「产品编号」—— 幂等,两个账套都要执行
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   为什么改(2026-09-30 用户报障 + 代码取证):

   用户要「产品规格书右上角显示对应的产品编号」,而实测封面第一行「编  号」显示的是
   **单据编号**(DEMO-SD-002),库里 rd_spec_doc_head.编号 的真值是产品编号(DEMO-A-001)。

   根因是**键名撞车**,不是显示问题:
     · 前端引擎把「编号」这个键当作**单据标识**四处用:
       PanelxList.vue currentFormData 里 `delete head['编号']` 后又 `编号: cur.value['编号']`
       (列表行里 loadDocs 写的「编号」= 单据编号) ⇒ 业务字段的值被单据号顶掉;
     · 后端 QueryService.loadDocs:361 `doc.put("编号", no)` 直接把单据编号写进同名键,
       覆盖同名字段值;
     · ButtonService.save():225 `body.remove("编号")` 把载荷里的「编号」当单据标识取走 ⇒
       该字段的值**永远落不了库**(同处注释原文:「同名列的字段永远无法随保存落库
       (实测 rd_spec_doc_head.编号 3 张单全为 NULL)」 — 现存值来自演示数据 seed);
     · 于是 ButtonService 的 REQUIRED_SYS_FIELDS 里还得专门把「编号」排除出必填校验。
   recordSheetConfigs.js:53 也留了同一结论:「规格书的 编号(=产品键)会被
   QueryService.loadDocs 用单据编号覆盖掉」。

   三处都在为"业务字段与单据标识同名"打补丁。正解是**把字段名与单据标识分开**:
   字段改叫「产品编号」(与产品信息表 RD_PROD_INFO.产品编号 同名同义,参照链路也更直白),
   「编号」这个键从此**只**表示单据标识。

   影响面(已逐处核对,以下都要同步,见同一提交的前端改动):
     · yj_field 两条(place=header/query):col_name、label → 产品编号;
       yj_translation 的 field 译名「产品编号」**已存在**(10 种语言,与产品信息表同键共享),
       不需要新增译名。
     · rd_spec_doc_head.编号 **列改名**为 产品编号(sp_rename 保留数据与列级中文注明)。
     · 前端:RDPanelLabels fixture、recordSheetConfigs 的封面 cover.fields、
       dashboard index.vue 的商品文档跳转键统一为「产品编号」。
   ⚠ 不改 yj_panel 的 group_col(code_col 仍是 单据编号):单据标识口径不变。
   ═══════════════════════════════════════════════════════════════════════════ */

-- ① 头表列改名(仅当旧列在、新列尚未出现 —— 重跑无副作用)
IF COL_LENGTH('dbo.rd_spec_doc_head', N'编号') IS NOT NULL
   AND COL_LENGTH('dbo.rd_spec_doc_head', N'产品编号') IS NULL
BEGIN
  EXEC sp_rename N'dbo.rd_spec_doc_head.编号', N'产品编号', N'COLUMN';
  PRINT N'[OK] rd_spec_doc_head.编号 → 产品编号(数据随列保留)';
END
ELSE
  PRINT N'[SKIP] rd_spec_doc_head 列改名(已改过或旧列不存在)';
GO

-- ② 字段元数据改名(header + query 两条一起改;参照关系 ref_panel/ref_field 不动)
UPDATE yj_field
   SET col_name = N'产品编号',
       label    = N'产品编号'
 WHERE panel_code = 'RD_SPEC_DOC'
   AND col_name  = N'编号';
GO

-- ③ 列级中文注明补齐(新列名要自带注明;丢注明 = 违反数据库规范)
IF COL_LENGTH('dbo.rd_spec_doc_head', N'产品编号') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep
              WHERE ep.major_id = OBJECT_ID(N'dbo.rd_spec_doc_head')
                AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.rd_spec_doc_head'), N'产品编号', 'ColumnId')
                AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'产品编号(参照 RD_PROD_INFO.产品编号;原列名「编号」,2026-09-30 改名以免与单据标识键撞车)',
         N'SCHEMA', N'dbo', N'TABLE', N'rd_spec_doc_head', N'COLUMN', N'产品编号';
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'产品编号(参照 RD_PROD_INFO.产品编号;原列名「编号」,2026-09-30 改名以免与单据标识键撞车)',
         N'SCHEMA', N'dbo', N'TABLE', N'rd_spec_doc_head', N'COLUMN', N'产品编号';
END
GO

-- ④ 消除同面板 label 重复:「日期」列(col_name=日期)在活库里被标成了「单据日期」,
--    与真正的「单据日期」字段撞名。后果是**静默取错列**:后端 QueryService.rowToLabels 与
--    labelsToCols 都按 **label** 建映射/反查,同面板 label 重复时只取首个 ⇒ 该列永远收不到值
--    (死列),列表里还会并排出现两个「单据日期」。
--    ⚠ 这是**既有的**问题,不是本轮改名引起的:2026-09-30 动手前的探针输出已显示
--      `col_name=日期 | label=单据日期`(而 HEAD 的 fixture 基线里它是「日期」,即活库被后来某次改动带偏)。
--      之所以现在才暴露:fixture 是活库快照,过期时不会报错,直到本轮因改名重生成才被
--      recordSheetConfigs.keys.test.js 的「同面板 label 不得重复」断言抓住。
--    处置:把 label 收回与列名一致(该列不进任何纸面配置,不改变任何界面显示)。
UPDATE yj_field
   SET label = N'日期'
 WHERE panel_code = 'RD_SPEC_DOC'
   AND col_name  = N'日期'
   AND label    <> N'日期';
GO

-- ⑤ 自检:旧键必须已消失、新键必须只有两条 header/query、同面板 label 不得重复
DECLARE @old int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='RD_SPEC_DOC' AND col_name=N'编号');
DECLARE @new int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='RD_SPEC_DOC' AND col_name=N'产品编号');
DECLARE @col int = (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.rd_spec_doc_head') AND name=N'产品编号');
DECLARE @dup int = (SELECT COUNT(*) FROM (SELECT label FROM yj_field WHERE panel_code='RD_SPEC_DOC' GROUP BY label HAVING COUNT(*) > 1) d);
IF @old = 0 AND @new = 2 AND @col = 1 AND @dup = 0
  PRINT N'[OK] RD_SPEC_DOC 改名完成(元数据 2 条 + 列 1 个,旧键 0;label 无重复)';
ELSE
  PRINT N'[WARN] 结果异常:旧键 ' + CAST(@old AS nvarchar(4)) + N' 条 / 新键 ' + CAST(@new AS nvarchar(4))
      + N' 条 / 列 ' + CAST(@col AS nvarchar(4)) + N' 个 / 重复 label ' + CAST(@dup AS nvarchar(4))
      + N' 组(期望 0/2/1/0)';
GO
