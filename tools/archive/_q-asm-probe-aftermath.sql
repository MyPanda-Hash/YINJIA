-- 【只读】探针跑完后:测试单据 ZJ-2026-10-0002 的明细是否原样(探针没点保存 ⇒ 应只有原有行)
SELECT d.[单据编号], d.[表区], d.[检验项目], d.[检验要求], d.[检查频率]
FROM dbo.qc_asm_insp_detail d
WHERE d.[单据编号] = N'ZJ-2026-10-0002' AND ISNULL(d.asp_cancel,'N') <> 'Y'
ORDER BY d.id;
