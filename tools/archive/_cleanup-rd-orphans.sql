/* _cleanup-rd-orphans.sql —— 研发模块清理的收尾:孤儿流程消息 + 已作废的僵尸单单据行
 *
 * 背景(2026-10-13 研发模块清理):主体单据已清完,核对后发现两类尾巴:
 *   ① yj_message 里 RD_* 面板的孤儿消息 —— 指向的单据在 yj_doc_status / 业务表里都已不存在
 *      (实测 HSDZ_MES_TEST 有 2 条 RD_CHANGE 的 SIGNOFF_REQUESTED,指向 CHG-2026-09-0038/0041,
 *       这两张单在本次清理前就已不在库里 ⇒ 历史遗留孤儿,不是本次清理造成的)。
 *   ② rd_progress 里 asp_cancel='Y' 的已作废单单据行(实测 HSDZ_MES_TEST 有 1 行 LXJ2609040100)。
 *      项目进度查询是单单据面板,全库只需保留 1 张有效单。
 *
 * 幂等:正式库上两者均为 0 行(no-op)。两账套都跑。
 * 用法:sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d <库> -C -f 65001 -i <本文件> -W -s"|"
 */
SET NOCOUNT ON;
DECLARE @msg int, @prog int;

/* ① 孤儿消息:RD_* 面板、且目标单据在 yj_doc_status 里查不到
      ⚠ yj_message 的列名是中文「面板编码」(不是 panel_code) */
DELETE FROM yj_message
 WHERE 面板编码 LIKE N'RD[_]%'
   AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.doc_no = yj_message.单据编号);
SET @msg = @@ROWCOUNT;

/* ② 已作废的进度单单据头(只删 asp_cancel='Y' 的僵尸行,有效单保留) */
DELETE FROM rd_progress WHERE ISNULL(asp_cancel, N'N') = N'Y';
SET @prog = @@ROWCOUNT;

SELECT N'[收尾] 删除孤儿消息' AS 项, CAST(@msg AS nvarchar(10)) AS 值
UNION ALL SELECT N'[收尾] 删除已作废进度单单据头', CAST(@prog AS nvarchar(10))
UNION ALL SELECT N'[收尾后] rd_progress 有效单单据行(应=1)', CAST(COUNT(*) AS nvarchar(10)) FROM rd_progress
UNION ALL SELECT N'[收尾后] RD_* 孤儿消息(应=0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_message m
   WHERE m.面板编码 LIKE N'RD[_]%' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.doc_no = m.单据编号);
