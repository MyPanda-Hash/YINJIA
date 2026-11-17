/* ============================================================================
 * migrate-asm-proc-fixed-manager-20261117.sql
 * 组装工艺管控清单：表单管理人**固定柴善银** + 补齐历史单据的「审核人」
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-17，1117问题 #6 追加）：
 *   「这个表单管理员应该是柴善银，是**固定的**，审批人在审批之后根据审批的人自动填入」。
 *
 * ① 表单管理人 = 柴善银（固定）
 *    原来这一格是「当前编辑人」（2026-10-28 口径），生产现值分布
 *    柴善银 10 / 陈秀丽 2 / 系统管理员 2 —— 用户本次明确要**固定**，故统一回填。
 *
 * ② 审核人（物理列 备用3）= 审批通过人
 *    代码侧已实现「审批通过时回填、弃审时清空」（ButtonService.writeFieldByLabel），
 *    但**改代码不动历史数据**：已有 3 张单 shr 有值、备用3 仍为空。
 *    本次按 yj_doc_status.shr 补上，并换成**姓名**（shr 存的是账号，纸面要显示人名，
 *    走 yj_user 映射；取不到姓名就退回账号原文，宁可显示账号也不留空）。
 *
 * 幂等：①② 都只在"值不满足目标"时才更新，重复执行 0 行。
 * 两账套都执行。
 * ========================================================================== */

SET NOCOUNT ON;

IF OBJECT_ID('rd_asm_proc_head') IS NULL
    RAISERROR(N'[asm-manager] 缺 rd_asm_proc_head', 16, 1);
IF COL_LENGTH('rd_asm_proc_head', N'备用3') IS NULL
    RAISERROR(N'[asm-manager] 缺「备用3」列（审核人落点，见 migrate-asm-proc-auditor-20261117.sql）', 16, 1);
GO

/* ---------- ① 表单管理人固定柴善银 ---------- */
UPDATE rd_asm_proc_head
   SET [表单管理人] = N'柴善银'
 WHERE ISNULL([表单管理人], N'') <> N'柴善银'
   AND ISNULL(asp_cancel, 'N') <> 'Y';
PRINT N'[asm-manager] 表单管理人回填柴善银 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ② 历史已审批单补审核人（账号 → 姓名，取不到退回账号） ---------- */
UPDATE h
   SET h.[备用3] = ISNULL(NULLIF(LTRIM(RTRIM(u.real_name)), N''), s.shr)
  FROM rd_asm_proc_head h
  JOIN yj_doc_status s
    ON s.panel_code = N'RD_ASM_PROC' AND s.doc_no = h.[单据编号]
  LEFT JOIN yj_user u
    ON u.username = s.shr
 WHERE ISNULL(s.shr, N'') <> N''
   AND ISNULL(h.[备用3], N'') = N''
   AND ISNULL(h.asp_cancel, 'N') <> 'Y';
PRINT N'[asm-manager] 历史审核人补齐 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ③ 自检：不该再有非柴善银的表单管理人 ---------- */
IF EXISTS (SELECT 1 FROM rd_asm_proc_head
            WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL([表单管理人], N'') <> N'柴善银')
    RAISERROR(N'[asm-manager] 自检失败：仍有非「柴善银」的表单管理人', 16, 1);
PRINT N'[asm-manager] 自检通过。';
GO
