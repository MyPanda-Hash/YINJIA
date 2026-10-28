-- migrate-mate-mno-length-20261021.sql
-- 物料清单(WLBOM,表 mate)保存报「将截断字符串或二进制数据」—— 单号 15 位塞进 14 位列。
--
-- 现象(2026-10-21 用户报):服务器上「物料清单」保存/新增报
--   服务异常：PreparedStatementCallback; 将截断字符串或二进制数据。
--
-- 根因(已复现:测试账套 POST /api/px/callButton {panelCode:WLBOM,buttonName:保存,formData:{}} 返回同一条):
--   ① WLBOM 是「单表式」单据面板(yj_panel.head_table IS NULL、line_table=mate、group_col=m_no);
--   ② 新建空白单走 ButtonService.saveDoc 的空表单分支 ⇒ FormNoService.next('WL') 生成
--      「WL-yyyy-MM-####」= 2+1+7+1+4 = **15 位**;
--   ③ 该单号被写进 group_col = mate.m_no,而 mate.m_no 是 **nvarchar(14)**(遗留 ERP 表)
--      ⇒ SQL Server 8152「将截断字符串或二进制数据」,保存直接 500。
--      本库 compatibility_level=100,报错文案不含表/列,现场只能看到一句"截断"。
--
-- 同批扫描(yj_panel head_table IS NULL + mode=doc,按 prefix+13 算应需长度):
--   WLBOM  前缀 WL → 需 15 位,m_no      = 14 ← 本次修复
--   CGD    前缀 CH → 需 15 位,od_no     = 14 ← 该面板指向的表在本库不存在(无效配置),不动
--   ROUTE  前缀 GY → 需 15 位,工艺路线编码 = 200  ← 正常
--   WO_REPORT 前缀 BG → 报工单号 = 30          ← 正常
--
-- 改法:mate.m_no 放宽到 nvarchar(30) —— 既容下单号(15 位,流水到 5 位也不会再撞),
--   也给用户手填的物料编码留余量(现场编码最长 7 位,旧上限 14 偏紧)。
--   放宽列长对读取方(视图/小程序/金蝶回写)一律兼容:写入 14 位以内的值行为不变。
--
-- 幂等:仅在当前长度 < 30 时执行 ALTER;两账套(HSDZ_MES / HSDZ_MES_TEST)都要跑。
SET NOCOUNT ON;

IF COL_LENGTH('dbo.mate', 'm_no') IS NULL
BEGIN
    PRINT N'[SKIP] dbo.mate 不存在 —— 本库没有物料清单表,跳过';
END
ELSE
BEGIN
    DECLARE @len INT =
        (SELECT CHARACTER_MAXIMUM_LENGTH
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'mate' AND COLUMN_NAME = 'm_no');

    IF @len IS NULL OR @len >= 30
        PRINT N'[SKIP] mate.m_no 已是 ' + ISNULL(CAST(@len AS nvarchar(10)), N'?') + N' 位,无需改';
    ELSE
    BEGIN
        ALTER TABLE dbo.mate ALTER COLUMN m_no nvarchar(30) NOT NULL;
        PRINT N'[OK] mate.m_no: ' + CAST(@len AS nvarchar(10)) + N' → 30 位(nvarchar)';
    END
END

-- 自检:改完必须是 30,否则视为失败(退出码仍 0,由调用方按 PRINT 判定)
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'mate' AND COLUMN_NAME = 'm_no';
