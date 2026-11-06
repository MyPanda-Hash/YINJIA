-- migrate-qc-insp-req-retire-custom-cat-20261106.sql — 来料检验要求:作废挂在**已下线页签**上的遗留行
--
-- 【背景 / 取证】tools/archive/_qc-insp-req-hint-20261106/README.md(含生产环境截图与接口取数)
--   用户报障(2026-11-06):检验数据记录 → 物料编码 YJ-XH-001 →「⧉ 检验要求」,弹窗「共 1 行」旁提示
--   「另有 1 行物料类别不在检验要求模板中」。查证:该物料在两个要求面板里共命中 2 行 ——
--     · qc_insp_req_series id=2  物料类别=炭粉(现役页签,正常显示成「炭粉」表);
--     · qc_insp_req      id=89  物料类别=自定义检验要求(**该页签 2026-10-04 已下线**)。
--   「自定义检验要求」页签随面板拆分下线(见 migrate-qc-insp-req-drop-custom-tab.sql:词表去值 +
--   字段退绑 + **当时存在的行软删**)。而下面这 4 行是 2026-10-14 21:43:53 由 admin 落入的(晚于下线),
--   类别仍写着旧值 ⇒ 现役 17 个页签(7 固定 + 10 系列)一个都装不下它,后果三连:
--     · 维护面板(来料检验要求)里**看不见、也改不了** —— 没有页签承载;
--     · 检验数据记录弹窗里只被计成「另有 N 行」,不给内容;
--     · 但「带入检验要求」仍按行自身字段名把它带进报告(外径/内径/厚度/材质/长/宽/尺寸/高度=按图纸、
--       克重=标称值±3%)⇒「弹窗看不见、报告带得进来」。
--
-- 【口径(用户 2026-11-06 选「a+b」)】这 4 行是**无处安放的遗留数据**:内容是占位值「按图纸」,
--   与真实检验标准不是一回事;它们正确的家应当是「来料检验要求(系列)」的 炭粉 页签(4 个物料在
--   bs_inv.所属类别 均为 炭粉)—— 但那是**另一张表**(qc_insp_req_series)、列结构完全不同
--   (检验方法n/检验标准n + 全自定义列),改一个 物料类别 值搬不过去。
--   故本次:**软删**(asp_cancel='Y'),行与内容原样保留、可回溯;真正的炭粉要求仍按正常流程维护在
--   「来料检验要求(系列) > 炭粉」(YJ-XH-001 已有 id=2 那条完整要求,不动)。
--   显示侧同批修(前端 QcInspReqViewDialog):归不进现役页签的行改渲染成「{类别} · 未归类」只读页签,
--   不再只计数 —— 今后再出现同类脏值,界面上**看得到**。
--
-- 【回滚】UPDATE qc_insp_req SET asp_cancel = 'N' WHERE id IN (89, 90, 91, 92) AND 物料类别 = N'自定义检验要求';
--
-- 【幂等】只动「仍存活 + 旧类别」的行 ⇒ 重跑影响 0 行;两账套均执行(正式库 4 行、测试库 0 行)。
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库时不得被切走)
GO

PRINT N'--- 执行前:将被作废的行(留档 / 回滚用 id) ---';
SELECT id, 物料编号, 文件编码, 检验依据, asp_user1, asp_time1
  FROM dbo.qc_insp_req
 WHERE 物料类别 = N'自定义检验要求' AND ISNULL(asp_cancel, 'N') <> 'Y'
 ORDER BY id;
GO

DECLARE @n int;
UPDATE dbo.qc_insp_req
   SET asp_cancel = 'Y'
 WHERE 物料类别 = N'自定义检验要求'
   AND ISNULL(asp_cancel, 'N') <> 'Y';
SET @n = @@ROWCOUNT;
PRINT N'[OK] 已软删(asp_cancel=Y) ' + CAST(@n AS nvarchar(10))
    + N' 行 —— 预期正式库 4 行、测试库 0 行;重跑应为 0。';
GO

-- ═════════════ 自检:两个要求面板都不许再有「归不进现役页签」的存活行 ═════════════
PRINT N'--- 自检 1:固定表(qc_insp_req)越界存活行,应为 0 ---';
SELECT N'固定表越界存活行' AS k, COUNT(*) AS n
  FROM dbo.qc_insp_req
 WHERE ISNULL(asp_cancel, 'N') <> 'Y'
   AND 物料类别 NOT IN (N'折叠棉', N'垫片', N'无纺布', N'网套', N'PP管', N'端盖', N'PP棉');

PRINT N'--- 自检 2:系列表(qc_insp_req_series)越界存活行,应为 0 ---';
SELECT N'系列表越界存活行' AS k, COUNT(*) AS n
  FROM dbo.qc_insp_req_series
 WHERE ISNULL(asp_cancel, 'N') <> 'Y'
   AND 物料类别 NOT IN (N'阻垢系列', N'BK材料系列', N'除重金属系列', N'矿化（碱性）系列',
                        N'抑菌系列', N'载银系列', N'炭粉', N'胶粉', N'矿化料', N'原料来料');

-- 自检 3:报障物料仍要能查到来料检验要求(炭粉 id=2 不动;本脚本不该让任何物料变空)
PRINT N'--- 自检 3:YJ-XH-001 的存活要求行(系列表,应 ≥1) ---';
SELECT N'YJ-XH-001 系列表存活行' AS k, COUNT(*) AS n
  FROM dbo.qc_insp_req_series
 WHERE LTRIM(RTRIM(物料编号)) = N'YJ-XH-001' AND ISNULL(asp_cancel, 'N') <> 'Y';
SELECT N'YJ-XH-001 固定表存活行(作废后应 0)' AS k, COUNT(*) AS n
  FROM dbo.qc_insp_req
 WHERE LTRIM(RTRIM(物料编号)) = N'YJ-XH-001' AND ISNULL(asp_cancel, 'N') <> 'Y';
GO
