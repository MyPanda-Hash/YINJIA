/* ============================================================================
   migrate-filter-eff-water-cols-20261029.sql
   功能性滤效 RD_FILTER_EFF「原水水质条件」块改为元数据驱动(2026-10-29)

   背景 —— 用户口径:
     「数据记录表的功能性滤性表的这个原水水质条件这一行做成可以自己新增列表格,
      和可以自己编辑这些列以及最前的标题的名字」

   改造前:8 个指标(自来水/纯水/超纯水/PH/TDS/缸内自来水VOC浓度/自来水加氯浓度/水温℃)
     连同它们的下拉/文本框**硬编码在 DataRecordSheet.vue 模板里** ⇒ 增删列、改名都得改代码。

   改造后:
     · yj_panel.config.waterIndicators = 指标列清单 [{key,name,kind}]
         - key  = 该面板已登记的**表头字段数据键**(物理列,加指标先用「自定义字段」绑备用列)
         - name = 默认列名(可被 config.rowLabels 覆盖)
         - kind = bool(√/× 下拉) | text(自由文本)
     · yj_panel.config.editableRowLabels = ['原水水质条件']  ⇒ 左侧行标题格可改名
     · yj_panel.config.rowLabels = {原名: 新名}            ⇒ 显示名覆盖(数据键不动,ADR-0001)

   幂等:只在 config 里**没有**这些键时才写入,已有则原样保留(用户改过的列名不会被回滚)。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @panel varchar(50) = 'RD_FILTER_EFF';

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = @panel)
BEGIN
    PRINT '跳过:面板不存在 ' + @panel;
    RETURN;
END

/* ── 1. waterIndicators:本次改造前的 8 个指标原样登记(顺序即纸面列序) ── */
DECLARE @cfg nvarchar(max) = (SELECT config FROM yj_panel WHERE panel_code = @panel);

IF @cfg IS NULL OR LTRIM(RTRIM(@cfg)) = ''
BEGIN
    SET @cfg = N'{}';
END

IF ISJSON(@cfg) = 0
BEGIN
    RAISERROR('yj_panel.config 不是合法 JSON,拒绝覆盖(请先人工修正 %s 的 config)', 16, 1, @panel);
    RETURN;
END

DECLARE @indicators nvarchar(max) = N'[
  {"key":"原水自来水","name":"自来水","kind":"bool"},
  {"key":"原水纯水","name":"纯水","kind":"bool"},
  {"key":"原水超纯水","name":"超纯水","kind":"bool"},
  {"key":"原水PH","name":"PH","kind":"text"},
  {"key":"原水TDS","name":"TDS","kind":"text"},
  {"key":"缸内自来水VOC浓度","name":"缸内自来水VOC浓度","kind":"text"},
  {"key":"自来水加氯浓度","name":"自来水加氯浓度","kind":"text"},
  {"key":"水温","name":"水温℃","kind":"text"}
]';

-- JSON_MODIFY 会转义普通字符串,这里用 JSON_QUERY 让它按 JSON 片段插入
IF JSON_QUERY(@cfg, '$.waterIndicators') IS NULL
    SET @cfg = JSON_MODIFY(@cfg, '$.waterIndicators', JSON_QUERY(@indicators, '$'));

IF JSON_QUERY(@cfg, '$.editableRowLabels') IS NULL
    SET @cfg = JSON_MODIFY(@cfg, '$.editableRowLabels', JSON_QUERY(N'["原水水质条件"]', '$'));

IF JSON_QUERY(@cfg, '$.rowLabels') IS NULL
    SET @cfg = JSON_MODIFY(@cfg, '$.rowLabels', JSON_QUERY(N'{}', '$'));

UPDATE yj_panel SET config = @cfg, config_at = SYSDATETIME() WHERE panel_code = @panel;

/* ── 2. 自检:三个键都在、且指标数 = 8 ──
   ⚠ 两个账套的 compatibility_level 都是 **100**(SQL Server 2008 兼容级),
     该级别**没有 OPENJSON**(实测报「对象名 'OPENJSON' 无效」)。
     所以这里用 ISJSON + 数 "key" 出现次数,不用 OPENJSON。 */
DECLARE @newCfg nvarchar(max) = (SELECT config FROM yj_panel WHERE panel_code = @panel);

IF ISJSON(@newCfg) = 0
BEGIN
    RAISERROR('自检失败:config 不是合法 JSON', 16, 1);
    RETURN;
END

IF @newCfg NOT LIKE '%"waterIndicators"%'
   OR @newCfg NOT LIKE '%"editableRowLabels"%'
   OR @newCfg NOT LIKE '%"rowLabels"%'
BEGIN
    RAISERROR('自检失败:config 三键不全', 16, 1);
    RETURN;
END

-- 指标条目数 = '"key"' 出现次数(EACH 条目必有一个 key;rowLabels 里不会有 "key")
DECLARE @n int = (SELECT (LEN(@newCfg) - LEN(REPLACE(@newCfg, '"key"', ''))) / LEN('"key"'));

IF @n <> 8
BEGIN
    RAISERROR('自检失败:waterIndicators 条目数应为 8,实际 %d', 16, 1, @n);
    RETURN;
END

PRINT '[OK] RD_FILTER_EFF 原水水质条件:waterIndicators=8 / editableRowLabels / rowLabels 就位';
