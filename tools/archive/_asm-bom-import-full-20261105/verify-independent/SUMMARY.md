# 独立复核报告 — 组装物料清单(ASM_BOM)全量导入 2026-11-05

> 复核员:`asm-bom-verifier`(独立 teeammate,**只读**;未修改 lead 任何产物文件)
> 任务:`task-1`。本目录(`tools/archive/_asm-bom-import-full-20261105/verify-independent/`)为复核产物。
> 工具链全部自写/自算:Excel 用 python openpyxl 独立重解析;库用自写 `IDump.java`(JDBC→JSON,无行数上限);
> SQL 文本用自写 `c_static.py` 状态机解析;RAISERROR 用自写 `RaiseProbe.java`;**未引用 lead 的 `verify.py` 结论**。

## 结论总览

| 项 | 结论 | 关键数字 |
|---|---|---|
| A 数据口径(Excel↔库) | **PASS** | 827 块 / 817 产品 / 3640 行;单据/产品集合零缺失零多余;每块行数分布逐项相等 |
| B 逐行+抽样比对 | **PASS** | 全量 3640 行 × 字段零差异(强于抽样);另随机 40 行零差异 |
| C SQL 安全性 | **PASS** | 23 批;DELETE 仅按来源;零 DDL;自检全按来源过滤;severity16 真失败实测成立;键唯一 |
| D 服务端包可执行性 | **PASS(有 3 条文档类 WARN)** | 包内 DbSync 实跑 `[OK] 23 batches`+自检 PASS;CHECK-after 实测输出符合;ASCII+CRLF+指纹全对 |
| E 回归 | **PASS** | 旧 1085/1085 键在库、除文档化的「备注」增强外逐字段零差异;47 列/3 索引/19 字段/1 面板行/modify_date 未动 |
| F 面板/取数口径 | **PASS** | totalSize=827;A-48-05_V0002 明细 9 行且逐字段对 Excel 零差异;排序口径 A-48-05→V0002、B-38-17→默认单 |

数据面最终态(`HSDZ_MES` 与 `HSDZ_MES_TEST` 一致):来源=`金蝶BOM引出列表_20261019174847` 共 **3640 行 / 827 单 / 817 产品**,
其它来源 2 行(开发期空草稿 `BOM-2026-10-0001`/`BOM-2026-11-0001`)原样保留。

---

## A. 数据口径(独立重读 Excel vs 库)

命令:
```bash
# Excel 独立解析(openpyxl,64 位 python 3.12)
python tools/archive/_asm-bom-import-full-20261105/verify-independent/analyze_excel.py
# 库整表导出(自写 IDump,JDBC→JSON)
cd tools && java -cp lib/mssql-jdbc.jar \
  archive/_asm-bom-import-full-20261105/verify-independent/IDump.java \
  HSDZ_MES archive/_asm-bom-import-full-20261105/verify-independent/q1_source_rows.sql \
  .../out-q1-HSDZ_MES.json
python .../compare.py
```
证据:`a-excel.txt`、`out-compare-A-B-E1.txt`、`excel-parsed.json`、`out-q1-HSDZ_MES*.json`。

| 指标 | Excel(本脚本独立解析) | 库(HSDZ_MES) | 库(HSDZ_MES_TEST) |
|---|---|---|---|
| BOM 块/单据 | 827 | 827 | 827 |
| 父产品 | 817 | 817 | 817 |
| 子件行 | 3640 | 3640 | 3640 |
| 每块行数分布 | `{1:27,2:231,3:127,4:73,5:93,6:84,7:84,8:71,9:19,10:17,12:1}` | 完全一致 | 完全一致 |
| 多版本产品 | 10(A-48-05/A-48-34/B-35-03/B-49-01-1/B-88-12/C-103-03/D-01-49/S051-2/T073-3/T123-2) | 10,集合与每产品两版单据编号完全一致 | 同 |
| 单据/产品集合差集 | — | 缺失 `[]` 多余 `[]` | 同 |
| 默认BOM='是' 块 | 13 | 13 | 13 |
| BOM 级备注非空块 / 行备注非空行 | 304 / 782 | 304 / 782 | 304 / 782 |
| 工艺路线名称空块 / 产品规格空块 | 34 / 32 | 34 / 32 | 34 / 32 |
| 工序名称(Excel 第 52 列) | 全空(工序=组装是代码口径,非 Excel 列) | 全 `组装` | 同 |

Excel 结构实测:sheet=`列表数据`,73 列,`max_row=3642` = 表头 1 + 数据 3640 + `合计` 尾行 1;
块首行同时携带表头字段与第 1 条子件;没有额外的全空「幻影行」(与 gen-report 的措辞差异见 W6)。

## B. 逐行+抽样比对

全量 3640 行逐字段(单据编号/产品编码/产品名称/规格型号/版本号/默认BOM/工艺路线名称/状态/行序/
子件编码/子件名称/子件规格/计量单位/标准用量/用量分子/用量分母/行备注/备注 + 工序/来源/损耗量/asp_*):
**全部零差异**;`标准用量=ROUND(分子/分母,4)` 不符 0 行;`计量单位` 空 0 行、全部命中 `bs_inv.计量单位`
(1261 个种子件编码全部有档案单位;Excel「分子单位」与档案单位 0 差异;无多单位歧义)。

抽样(固定随机种子,40 行,覆盖:多版本 A-48-05/S051-2/T073-3、行备注非空 8+空 6、分母≠1 8、
产品规格为空 5、工艺路线为空 5):**0/40 不一致**。证据 `out-compare-A-B-E1.txt`。

## C. SQL 安全性审查(`tools/migrate-asm-bom-data-full-20261105.sql`)

证据:`out-C-static.txt`、`out-C-raiserror-probe.txt`、`out-q6-failtest-log.json`、`out-D-pkg-dbsync-run.txt`。

- 文件:1,302,703 字节,UTF-8 无 BOM,SHA-256 `9717cd04…`(与 `yj_schema_log.content_hash`、包内 `SHA256SUMS.txt` 三处一致)。
- 批数 23(GO):守卫 1 + DELETE 1 + INSERT 19(每批 ≤200 行:18×200 + 40)+ UPDATE 1 + 自检 1。
- **DML 精确计数:DELETE=1、INSERT=19、UPDATE=1;DDL/权限/整库语句 = 0**(全文 DROP/TRUNCATE/ALTER/CREATE 均 0 次,仅出现在注释文字外无)。
- DELETE 原文仅 `WHERE 来源 = N'金蝶BOM引出列表_20261019174847'`:含 OR=False、含其它列条件=False;
  SQL 语义上 `来源=NULL` 不满足等值 → **2 行面板手工草稿不会被删**(实测导入前后这 2 行完全不变)。
- UPDATE(计量单位回填)顶层 WHERE 同理仅 `WHERE b.来源 = N'...'`。
- 自检计数**全部**带来源过滤(含行序连续性子查询);故以后重跑(其它来源变化)不会误 FAIL。
- RAISERROR 硬失败实测(`RaiseProbe.java`,只读):severity **16 → SQLException**(DbSync `runFile` 判失败、
  exit 1、**不写 yj_schema_log**);severity **10 → SQLWarning code=50000**,命中 DbSync `INFO_CODES` 只打印 `[print]`。
  另做负向测试:`DbSync.java run _fail-severity16.sql` → exit=1、`yj_schema_log` 该脚本 0 行(实测),证明「FAIL 分支真能挡住」。
  ⚠ AGENTS 的「RAISERROR 不中止批次」在此脚本不构成风险:FAIL 的 RAISERROR 是自检批**最后一条语句**,
  该批不含任何写操作;写操作都在 RAISERROR 之前的独立批次。
- 唯一索引兼容:`uq_bs_asm_bom_doc_line(单据编号,行序) WHERE asp_cancel<>'Y'`;脚本 3640 键**无重复**,
  且全部 `asp_cancel='N'`;实测插入成功、导入后行序逐单 1..n 连续(不连续单 0)。
- 与上一版关系:`tools/db-migrations.txt` 内 `migrate-asm-bom-data-20261030.sql`(第 4388 行)在
  `migrate-asm-bom-data-full-20261105.sql`(第 4453 行)**之前**;两脚本同一来源标记、同一 DELETE 口径;
  静态核验旧脚本 1085 键是脚本内 INSERT 键的**子集**(超集关系成立);顺序执行终态=本脚本。
- 已接受风险(非缺陷,DbSync 头注已声明):23 批各自提交,若中途失败(或自检 FAIL)会「数据已生效但未登记」,
  重跑幂等可修复。服务端 apply.bat 会以非 0 退出并提示回滚点。

## D. 服务端包可执行性(`deploy/incr-asm-bom-full-20261105/`)

- `apply.bat`/`check.bat`:纯 ASCII(无任何非 ASCII 字节)、CRLF(114/114、13/13 行)、无控制字符;
  `-f i:65001,o:65001` 已按仓库惯例补齐(read-only CHECK 的 UTF-8 中文来源标记可安全读取);文件指纹与 `SHA256SUMS.txt` 全对。
- 包内 `migrate-…sql` / `tools/DbSync.java` / `tools/lib/mssql-jdbc.jar` 与仓库文件 **逐字节一致**(cmp);
  `tools/db-migrations.txt` 为最小清单(run 模式不消费内容);包内 8 个文件 SHA-256 全部与 `SHA256SUMS.txt` 相符。
- 包内 DbSync 实跑(把包整体拷贝到临时目录,按 apply.bat 的 `copy` 步骤把脚本放进 `tools/`,再在包内 `tools/` 用包内 jar 跑):
  ```bash
  cd <stage>/tools && java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 \
    -cp lib/mssql-jdbc.jar DbSync.java run migrate-asm-bom-data-full-20261105.sql
  # EXIT=0
  # [print] [INFO] asm-bom full import: rows=3640 docs=827 prods=817 missing_unit=0 blank_sub=0 bad_seq_doc=0 ...
  # [print] [PASS] asm-bom full import self-check OK (expect rows=3640 docs=827 prods=817)
  # [OK] 23 batches
  ```
  复跑幂等实测:重跑前后 3640 行业务字段**零变化**(仅 `asp_time1` 被重写);2 行其它来源行逐字段不变。
- `CHECK-after.sql` **原文**用 JDBC 执行(本机无 sqlcmd,用等价 read-only 执行;见 W1)输出:
  ```
  rows=3640 docs=827 prods=817 missing_unit=0 bad_seq_docs=0
  schema_log=1 multi_version_products=10 other_source_rows=2
  panel_docs=829
  ```
  与 README-AI §3 判据逐项对照:前 6 项一致;`other_source_rows`/`panel_docs` 本地为 2/829,
  README 已明确标注为「服务器应为 0 / 827」(服务器无开发期草稿)——该说明与实测自洽,**不会让服务器误判**
  (apply.bat 的 findstr 也不断言这两项)。
- README-AI §3 的 `[print]`/`[OK] 23 batches` 预期输出与实测一致;§7 两账套 3640/827/817/missing_unit=0 与本次独立复核一致。
- **本机限制**:`where sqlcmd` 为空,故 apply.bat/check.bat 的 sqlcmd 分支(预检/备份/`-i` 读 CHECK)无法在本机端到端执行;
  其 SQL 均单独用 JDBC 等价验证,批处理逻辑逐行审阅。包内 DbSync 部分已用包内副本真跑。
- **打包链复核(lead 2026-11-05 00:25 补充后重验)**:`tools/archive/_assemble-asm-bom-full-pkg.ps1` 存在,
  内容与 README-AI §2 描述一致(清理派生物→从仓库真源拷 SQL/DbSync/jar→写最小清单→校验 bat ASCII/CRLF→
  重写 SHA256SUMS→压 zip→`RESULT: PKG-OK/FAIL`);`.gitignore` 241-245 行确认 SQL 副本/`tools/`/`SHA256SUMS.txt`/`logs/`/zip
  均为忽略的派生物,`git status` 中该包只有 4 个源文件(README-AI/apply/check/CHECK-after)被跟踪 ⇒ 与 README 声明一致。
  `deploy/incr-asm-bom-full-20261105.zip` 存在(9 个文件);解压后 8 个文件 SHA-256 与 `SHA256SUMS.txt` **全部相符**
  (含 00:25 更新后的 README-AI.md=`7dc36020…`)。**注意**:该 zip 的条目名用反斜杠作路径分隔符(Info-ZIP 提取时警告
  "appears to use backslashes as path separators";文件仍能正确落目录),见 W7。

## E. 回归

证据:`out-compare-A-B-E1.txt`、`out-q3-meta-HSDZ_MES.json`、`out-q5-ddl-dates.json`、`out-q1-HSDZ_MES-afterrun.json`。

- **旧 236 单/1085 行**:从 `migrate-asm-bom-data-20261030.sql` 文本解析出 1085 行(状态机,处理 `N'…''…'`/`NULL`/`SYSDATETIME()`);
  1085/1085 键在现库;除下列**已文档化**的差异外逐字段(产品编码/名称/规格/版本号/默认BOM/工艺路线/状态/
  子件编码/名称/规格/标准用量/分子/分母/损耗量/行备注/asp_user1/asp_user2/asp_time2/asp_cancel)**零差异**:
  - `备注`(BOM 级备注)由 NULL→非空 448 行 —— 全量脚本新增字段,脚本头注/文档明确「上一版漏导,本次补上」,属口径增强;
  - `计量单位` 旧脚本先 NULL 再按档案回填,现库与「档案优先,查不到用 Excel 分子单位」口径不符 0 行。
- **其它来源行**:导入前后 2 行(`BOM-2026-10-0001`/`BOM-2026-11-0001`)逐字段不变(与 q5 导出比对)。
- **表结构/索引/面板元数据**(`sys.columns`/`sys.indexes`/`yj_panel`/`yj_field` 实测):
  47 列(与 `migrate-asm-bom-20261030.sql` 定义逐列一致:如 nvarchar 的 max_length 字节数=50/100/200 字符等);
  3 索引 = `pk_bs_asm_bom`(clustered PK)+ `uq_bs_asm_bom_doc_line`(unique filtered `asp_cancel<>'Y'`)+
  `ix_bs_asm_bom_prod_process`;`yj_panel` ASM_BOM 1 行、`yj_field` 19 行(序号/位置与 2026-11-04 可维护迁移后的终态一致);
  48 条 `MS_Description`(表 1 + 27 业务列 + 备用 20);`bs_asm_bom` 的 `sys.objects.modify_date` 停在
  **2026-10-30** (早于本次导入),且脚本零 DDL ⇒ 本任务未改表结构。
- 迁移清单:本脚本在 `tools/db-migrations.txt` 末尾登记 1 次,顺序晚于建表/旧数据脚本。

## F. 面板/取数口径(8090 活体)

命令:`python .../f_probe.py`(自写 urllib,admin/123456 登录;只读查询)。证据 `out-F-panel-api.txt`。

- `GET /api/px/getPanelConfig?panelCode=ASM_BOM` → 200,面板「组装物料清单」;
- `POST /api/px/queryFormDataList` countOnly → 200 `{"totalSize":827}`;列表首页 totalSize=827
  (SQL 口径 `panel_docs=829` 的差=2 张开发期草稿,它们在 `yj_doc_status` 里 `canceled='Y'`
  ⇒ 面板列表按 `NOT EXISTS(… canceled='Y')` 排除;两口径自洽,见 `out-q9-docstatus.json`);
- 产品过滤 A-48-05 → `totalSize=2`,单据 `A-48-05_V0002 / A-48-05_V0001`;
- `GET /api/px/getFormDescriptor?panelCode=ASM_BOM&code=A-48-05_V0002` → 明细 **9 行**,
  与 Excel 该单 9 行逐字段(行序/子件编码/名称/规格/计量单位/标准用量/行备注/备注)**零差异**;
- 多版本取数口径(与后端代码同 SQL,DB 侧实测 `q8_f_api_support.sql`):
  `A-48-05` → **A-48-05_V0002**(无默认BOM,版本号大者胜);
  `B-38-17` → **B-38-17_V0001**(默认BOM='是');源码 `MobilePickController.latestAsmBom` /
  `WorkReportController.asmBomOf` 均为 `默认BOM=是 → 版本号 DESC → 单据编号 DESC`,与实测一致。
  活体接口未调用:`plang` 中无 A-48-05/B-38-17 的工单行(q8 第 4 批 0 行),报工 context/领料接口无法以这两个产品触发;
  但两端用的 SQL 已按原文复跑并比对。
- `B-38-17_V0001` 明细 5 行(默认单可取明细)。

---

## 发现的问题(WARN / 建议;未改 lead 文件)

| # | 严重度 | 位置 | 问题 | 最小复现 | 建议 |
|---|---|---|---|---|---|
| W1 | 中(文档/流程风险) | `deploy/incr-asm-bom-full-20261105/README-AI.md` §6 | 写「下次常规增量部署的 to-run 列表**会自动包含**它」不准确:增量包的 to-run.txt 是**每个包手工定稿**的文件(见 `tools/archive/_deploy-20261102/_build-pkg-incr-*.mjs`、`deploy/部署说明.md`)。若下次包未把它加进 to-run,`deploy-incremental.bat` 的 `[4b] baseline` 会**只登记不执行**该脚本(把脚本名写进 yj_schema_log 但不导数据),随后 `[4c] sync` 视为已执行跳过 ⇒ 服务器永远没有数据 | 读 `deploy/deploy-incremental.bat:145-150`(`baseline` 在 `sync` 前) + `DbSync.java` `baseline` 分支 markApplied 不执行脚本 | 改 §6 措辞:「本脚本已登记仓库清单;下次增量部署**必须把它加入该包的 to-run.txt**(或先执行本包 apply.bat),否则 [4b] baseline 会登记为已执行而不导数据」 |
| W2 | 低(文档与实现不一致) | 同上 §3「判据(全部要满足才能算成功)」 | apply.bat 实际只断言 6 项(rows/docs/prods/missing_unit/bad_seq_docs/schema_log);`multi_version_products`、`other_source_rows`、`panel_docs` 只打印不断言,表格却列为判据 | 读 `apply.bat:64-76` findstr 列表 | 表格标注「前 6 项为自动判据,后 3 项为人工核对参考值」,或对 `multi_version_products=10` 增加 findstr(另两项依赖服务器基线,不建议硬断言) |
| W3 | 低(文档路径) | 同上 §5 回滚 | 「只回到旧口径:在服务器 `C:\yinjia\tools` 下跑 DbSync run 旧脚本」——常规部署脚本从不把 `tools/` 安装到 `C:\yinjia`(deploy-incremental.bat 全程 `pushd "%PKG%\tools"`),服务器该目录很可能不存在/无旧脚本,该回滚命令会失败 | 读 `deploy/deploy-incremental.bat` 全文无 `copy tools`;`grep -rn "copy.*tools" deploy/*.bat` 无结果 | 回滚首选整库还原 `.bak`(已写);旧口径回滚改为「从仓库/上一个部署包取出旧脚本+DbSync,放到临时目录执行」,并注明依赖 |
| W4 | 低(健壮性) | `apply.bat` preflight | 未像 `deploy-incremental.bat:52` 那样先判 `IS_SRVROLEMEMBER('sysadmin')`;若服务器 Windows 管理员不是 sysadmin,备份会 SQL 报错(无 `-b`,sqlcmd 可能仍返回 0),靠 `.bak 不存在` 兜住 → 以 `FAIL-BACKUP` 停下(不会动数据,行为安全,但错误信息指向备份而非权限) | — | 可选:preflight 加 `sqlcmd -Q "SELECT IS_SRVROLEMEMBER('sysadmin')"` 并 findstr=1,给清晰 FAIL-SYSADMIN(与既有部署脚本同惯例) |
| W5 | 信息(已接受) | 导入脚本 23 批 | DELETE+19 批 INSERT+UPDATE 非单事务(每批自动提交);若中途失败/自检 FAIL,库会处于「数据已替换但 yj_schema_log 未登记」状态,重跑幂等可恢复;服务端以非 0 退出并提示回滚点 | — | 无需改;已由 DbSync 头注声明,本次向 lead 备案即可 |
| W6 | 极低(措辞) | `gen-report.md`/`README.md` §三 | 「3642 行;幻影空行丢弃 1、T410_V0001 7→6」:实测 3642=表头+3640 数据+`合计` 尾行,无额外全空行;被丢弃的是 `合计` 汇总行(紧跟在最后一个块 T410_V0001 之后,故被描述成该块尾行),T410_V0001 实际就是 6 行 | `analyze_excel.py` 输出「数据行 3640 / 全空行 0」 | 仅措辞,建议改成「表头 1 + 数据 3640 + 合计 1;丢弃合计行」;数字结论(827/817/3640)不受影响 |
| W7 | 低(打包健壮性) | `_assemble-asm-bom-full-pkg.ps1` / 生成的 zip | ① zip 条目名用 `\` 作路径分隔符(解压工具 `unzip` 警告,Windows 资源管理器/7-Zip 一般能归一化,`tar` 类工具可能把 `tools\DbSync.java` 落成扁平文件名);② 函数名 `Copy-Verified` 的注释宣称「逐字节校验」,实际只比对**文件长度**,不比对内容哈希(SHA256SUMS 由包内副本算出,当前实测与仓库源一致,但脚本本身没做源↔派生的哈希比对) | `unzip -l deploy/incr-asm-bom-full-20261105.zip` 显示 `tools\db-migrations.txt` 等条目;`Copy-Verified` 仅比较 `(Get-Item).Length` | 建议用 PowerShell 7(`pwsh`)/`[IO.Compression.ZipFile]` 生成正斜杠条目,并让 `Copy-Verified` 改为 `Get-FileHash` 源/目的比对(与 README §2「逐字节校验」措辞对齐) |

> 另注:本次复核执行了任务 D 允许的 `DbSync run`(对 `HSDZ_MES`,幂等)一次,用于实测 23 batches/自检/幂等;
> 该操作只把 `asp_time1` 刷新为执行时间,业务值零变化(实测 pre/post 逐字段比对),`yj_schema_log` 哈希不变。
> 未对 `HSDZ_MES_TEST` 执行任何写操作;未执行 sqlcmd 备份/还原;未运行 lead 的脚本副本之外的东西。

## 复核证据文件清单(本目录)

| 文件 | 内容 |
|---|---|
| `IDump.java` | 自写只读导出器(JDBC→JSON,无行数上限,转义安全) |
| `analyze_excel.py` / `a-excel.txt` / `excel-parsed.json` | A:openpyxl 独立解析 Excel(块/产品/行/多版本/备注/空规格统计) |
| `compare.py` / `out-compare-A-B-E1.txt` | A/B/E-1:全量逐字段比对 + 40 行抽样 + 旧脚本 1085 行同键比对 |
| `c_static.py` / `out-C-static.txt` | C:SQL 文本静态审查(语句计数/DELETE/UPDATE/DDL/自检/键唯一/超集/清单顺序) |
| `RaiseProbe.java` / `out-C-raiserror-probe.txt` | C:RAISERROR severity 10/16 的 JDBC 行为实测 |
| `_fail-severity16.sql` + `out-q6-failtest-log.json` | C:DbSync 负向测试(FAIL 不写 yj_schema_log) |
| `q1_source_rows.sql` / `out-q1-HSDZ_MES.json` / `out-q1-HSDZ_MES_TEST.json` / `out-q1-HSDZ_MES-afterrun.json` | 来源行全量导出(pre/post 幂等比对) |
| `q2_other_rows.sql` / `out-q2-other*.json` | 其它来源行(2 行草稿)pre/post |
| `q3_meta.sql` / `out-q3-meta-HSDZ_MES.json` | E:表列/索引/面板/字段/schema_log 元数据 |
| `q5_ddl_dates.sql` / `out-q5-ddl-dates.json` / `out-q5-afterrun.json` | E:modify_date/扩展属性/config/草稿行 |
| `q4_inv_units.sql` / `out-q4-invunits-HSDZ_MES.json` | B:子件编码↔存货档案单位 |
| `q7_run-checkafter.sql` / `out-D-checkafter.json` / `out-D-real-CHECK-after.json` | D:CHECK-after 判据(含原文执行) |
| `out-D-pkg-dbsync-run.txt` | D:包内 DbSync 实跑输出(EXIT=0 / 23 batches / PASS) |
| `q8_f_api_support.sql` / `out-F-support.json` | F:多版本排序口径 SQL 实测 |
| `q9_docstatus.sql` / `out-q9-docstatus.json` | F:panel_docs 829 vs totalSize 827 的解释 |
| `f_probe.py` / `out-F-panel-api.txt` | F:8090 面板/详情活体探针 |
