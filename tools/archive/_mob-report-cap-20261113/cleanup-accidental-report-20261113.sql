-- 2026-11-13 测试痕迹清理:手机端工序报工「超量弹窗」E2E 时误提交的一笔真实报工
--
-- 事故经过:
--   我在 5173 手机端工序报工页做「超量弹窗」验收时,脚本在验证「改为 100」之后又点了一次「提交报工」,
--   数量 100 恰好等于可报上限 ⇒ 真的建单并审核了 GD-2026-11-0012 行3「装箱」100 支,
--   报工单号 BG-2026-11-0017(已审核,影响工序台账:装箱 已报 1100→1200)。
-- 已做的软回退(走正常业务口,不是直接改库):
--   ① callButton(WO_REPORT, 弃审) ⇒ 单据回到草稿,工序台账 已报 1100 / 待审核 100;
--   ② callButton(WO_REPORT, 删除) ⇒ 单据 已作废(canceled='Y')。
-- 本脚本硬删残留(scjl 行 + 状态行 + 审批留痕),守卫:
--   仅正式库 HSDZ_MES;scjl 行必须精确匹配(id/工单/工序/数量/未审核);
--   末尾自检 3 项残留必须为 0。
SET NOCOUNT ON;
IF DB_NAME() <> N'HSDZ_MES'
    THROW 50001, N'本清理脚本只允许在正式库 HSDZ_MES 执行', 1;

DECLARE @scjlId INT = 4406;
DECLARE @docId INT = 34153;
DECLARE @docNo NVARCHAR(50) = N'BG-2026-11-0017';

IF NOT EXISTS (SELECT 1 FROM dbo.scjl
               WHERE id = @scjlId AND gldh = N'GD-2026-11-0012' AND gxdm = N'装箱'
                 AND sl = 100 AND ISNULL(wgzt, N'N') <> N'Y')
    THROW 50002, N'scjl 行不匹配(可能已清理/数据已变),中止', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status WHERE id = @docId AND doc_no = @docNo)
    THROW 50003, N'yj_doc_status 行不匹配,中止', 1;

DELETE FROM dbo.yj_form_approval WHERE form_no = @docNo;
DELETE FROM dbo.yj_doc_status WHERE id = @docId AND doc_no = @docNo;
DELETE FROM dbo.scjl WHERE id = @scjlId;

SELECT 'RESIDUE' AS k,
       (SELECT COUNT(*) FROM dbo.scjl WHERE id = @scjlId) AS scjl_residue,
       (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE doc_no = @docNo) AS doc_residue,
       (SELECT COUNT(*) FROM dbo.yj_form_approval WHERE form_no = @docNo) AS appr_residue;
