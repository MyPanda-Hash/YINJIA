/* _seed-a4test01-spec-detail-20261014.sql —— 给测试规格书补「尺寸」行与「物料清单」行
 *
 * 用户口径(2026-10-14):「补这两处数据」。目的 = 让刚做完的两条链能在 8090 上实测:
 *   · 尺寸公差解析:规格书「检验要求」里 `检验项目=尺寸` 那行 → 成型工艺清单的
 *     外径mm / 外径公差 / 内径mm / 内径公差;
 *   · 配方表带出:规格书「物料清单」表区的 `物料编码` → 配方表「物料编号」,
 *     并据 `bs_inv.所属类别` 带出「物料种类」。
 *
 * 为什么直插物理表而不是走界面:该规格书(SD-2026-10-0004)**已归档**,界面上改不了明细;
 *   而两条链的服务端取数就是按 `单据编号 + 表区` 直读 rd_spec_doc_detail
 *   (DevTaskService.specDetailRows),所以补行即生效、无需动单据状态。
 *
 * ⚠ 只跑**测试账套 HSDZ_MES_TEST** —— 正式账套不许有测试数据。
 * 幂等:NOT EXISTS 守卫(按 单据编号+表区+序号 判定),重复执行 = 0 行。
 *
 * 用法:sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d HSDZ_MES_TEST -C -f 65001 -i <本文件> -W -s"|"
 */
SET NOCOUNT ON;

DECLARE @no nvarchar(120) = N'SD-2026-10-0004';

/* ① 补前报数 */
SELECT ISNULL(表区, N'(空)') AS 表区, CAST(COUNT(*) AS nvarchar(6)) AS 行数
  FROM rd_spec_doc_detail WHERE 单据编号 = @no GROUP BY 表区;

/* ② 补「尺寸」行(进 检验要求 表区;序号续到 4) */
INSERT INTO rd_spec_doc_detail
      (单据编号, 表区, 序号, 检验项目, 检验要求, 检验方法, 检验依据, asp_user1, asp_time1, asp_cancel)
SELECT @no, N'检验要求', N'4', N'尺寸', N'外径 20±0.5mm、内径 5±0.3mm、长度 250±2mm', N'游标卡尺', N'YJ-Q-31',
       N'admin', SYSDATETIME(), N'N'
 WHERE NOT EXISTS (SELECT 1 FROM rd_spec_doc_detail
                    WHERE 单据编号 = @no AND 表区 = N'检验要求' AND 序号 = N'4');
PRINT N'[补] 尺寸行: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ③ 补「物料清单」两行(物料编号/名称;规格参数与数量也填上,便于观察带入效果) */
INSERT INTO rd_spec_doc_detail
      (单据编号, 表区, 序号, 物料编码, 物料名称, 规格参数, 数量, 备注, asp_user1, asp_time1, asp_cancel)
SELECT @no, N'物料清单', v.序号, v.编码, v.名称, v.规格, v.数量, N'',
       N'admin', SYSDATETIME(), N'N'
  FROM (VALUES (N'1', N'M-001', N'炭棒',   N'Ø20×250mm', N'1'),
               (N'2', N'M-003', N'炭纤维', N'—',          N'1')) AS v(序号, 编码, 名称, 规格, 数量)
 WHERE NOT EXISTS (SELECT 1 FROM rd_spec_doc_detail
                    WHERE 单据编号 = @no AND 表区 = N'物料清单' AND 序号 = v.序号);
PRINT N'[补] 物料清单行: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ④ 自证:两个表区各多少行 */
PRINT N'=== 补后明细 ===';
SELECT 表区, 序号, ISNULL(检验项目,N'') AS 检验项目, LEFT(ISNULL(检验要求,N''), 40) AS 检验要求,
       ISNULL(物料编码,N'') AS 物料编码, ISNULL(物料名称,N'') AS 物料名称
  FROM rd_spec_doc_detail WHERE 单据编号 = @no ORDER BY 表区, 序号;

SELECT N'[自证] 检验要求 行数(应=4)' AS 项, CAST(COUNT(*) AS nvarchar(6)) AS 值
  FROM rd_spec_doc_detail WHERE 单据编号 = @no AND 表区 = N'检验要求'
UNION ALL SELECT N'[自证] 物料清单 行数(应=2)', CAST(COUNT(*) AS nvarchar(6))
  FROM rd_spec_doc_detail WHERE 单据编号 = @no AND 表区 = N'物料清单';
