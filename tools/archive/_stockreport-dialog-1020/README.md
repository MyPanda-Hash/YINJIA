# _stockreport-dialog-1020 — 库存台账/收发存汇总「重复弹窗 + 查询问题」(2026-10-20 用户报障)

**用户原话**:「库存台账和收发存汇总表出现重复弹窗和查询问题」

> 口径确认(用户 2026-10-20 二选一追问,均选「推荐」):
> ① 重复弹窗 = **进面板弹一次 → 后台刷新/切页签回来又弹一次(且刚填的条件没了)**;
> ② 台账查询问题 = **一起修掉**(后端名称/编码口径)。

---

## 一、两个根因与修法

### A. 重复弹窗(前端门控,`PanelxList.vue`)

| | |
|---|---|
| 现象 | 台账/汇总进面板弹条件弹窗;关掉或查完后,后台任何一次 `load()`(切页签双触发 / 刷新 / 列设置保存后 / 导入后…)又把弹窗顶出来;重开时草稿被清 ⇒ 用户看到「弹窗关了又弹、刚才选的仓库/存货没了」 |
| 根因 | 「进入即弹」的门只按 `reportQueryDialog && !rqdDone` 判 —— **不认"弹窗本来就开着"**;而 `load()` 在一个面板生命周期里会被十几处调用,两条并行 `load()` 都能过门 ⇒ 重复弹窗。且 `load()` 里调的是 `openQueryDialog()`,它**每次都重置条件草稿** |
| 修法 | 判定口径抽成纯函数 `@core/report/reportQuery`:`shouldAutoOpenReportQuery({enabled,panelCode,hasApplied,dialogVisible})`(含"弹窗已开着则不弹"+ 组件侧 `rqdOpening` 重入闸);`load()` 只走 `openReportQueryIfNeeded(false)`(只让弹窗"亮着"、**不重置用户已填条件**),只有首次进入/用户点「查询」才 `fresh=true` 重置 |
| 附带 | ① 弹窗顶部新增「生效中」一行,把**正在生效**的条件摊开(与草稿区分,取消即回到生效状态);② 日期段为空时自动带出「本月初 → 今天」(T+ 报表同款),不再逼用户先点两次日期;③ 必填校验收敛到 `validateReportQuery` |

单测:`frontend/src/core/report/reportQuery.test.js`(7 条);时序回归:`_v-dialog-flow.mjs`(14 条)。

### B. 台账查询只剩期初/期末两行(后端口径,`QueryService`)

| | |
|---|---|
| 现象 | 库存台账选「仓库 + 存货 + 日期段」查询,**明细行全空**,只剩首行「期初结存」与末行「期末结存」两行合成行 |
| 根因 | `QueryService#queryFlat` 对台账/状况表写死 `AND RTRIM(t.[仓库编码]) = 仓库值`(即把 condition 里的 **仓库/存货 当成编码**),而弹窗里这两格放的是**名称**(弹窗回显 + 参照 label)⇒ 名称拿去和编码比 ⇒ 恒 0 行;更糟:`_whCode` 那条编码过滤有前置条件 `l2c.containsKey("仓库编码")`,而台账的「仓库编码」字段 `place=detail`、不进查询字段表 ⇒ **编码过滤一次都没生效过**。合成行同样按"名称=编码"算,于是连期初/期末的数也是 0 |
| 取证 | `_probe-ledger-filter.mjs`:`② 只送名称 → totalSize=2 明细=0 合成=2`;`③ 只送编码 → 75/49/2` |
| 修法 | 名称/编码判据收敛成一个 helper `appendWhItemFilter`(台账/状况表/汇总同一口径):**编码优先**(`_whCode`/`_itemCode`)→ 名称位若本身就是编码也认 → 否则**名称精确等值**(绝不 LIKE,子串会串仓「成品仓」命中「半成品仓」);合成行按同一口径取匹配值/匹配列 |
| 自检 | `_QVerify.java`:`① 编码 = 73 行`、`② 名称 = 120 行`、`③ 旧 bug 现场 = 0 行`(120 与 73 的差额是同名多码,见下) |

> ⚠ **名称口径的已知代价**(日志:`_QNameCollide.java`):同仓同名的存货可有 12 个不同的存货编码
> (`成品B仓 / PP复合阻垢炭棒/滤芯` = A-48-19 73 行 + A-48-09 20 + T377 9 + …,合计 120 行)。
> 名称查询会把它们并成一份 —— 这正是本轮**没改**「仓库/存货参照绑编码」的原因:弹窗选了参照就走编码
> (单码单一性,73 行),只有名称位里没有对应编码时才退化到名称。要彻底消除并流,得把参照的
> `ref_field` 真正绑到编码列(台账那把参照下拉返回的是**名称**,这是 2026-09-28 `migrate-ledger-code-filter.sql`
> 想绑、但下拉控件回填的是 label 的遗留口径),属另一个任务的量。

---

## 二、产物清单

| 文件 | 用途 |
|---|---|
| `_probe-ledger-filter.mjs` / `.out` | 台账名称/编码四种送法对照(修复前后端口径证据) |
| `_QVerify.java` | 直接对 SQL 验「编码精确 / 名称精确 / 旧 bug 现场」三种 WHERE 的行数(两账套) |
| `_QNameCollide.java` | 名称精确等值的同名多码规模(解释 120 vs 73) |
| `_QDetail.java` | 台账里真有流水的 (仓库,存货) 样本 |
| `_QTrace.java` / `_QGaps.java` | 台账画面溯源:视图行数、该组合行数/日期范围、按月分布、尾空格检查 |
| `_QFields.java` | 两面板 yj_field 元数据快照(place/seq/visible/ref_panel) |
| `_dump-cfg.mjs` / `cfg-*.json` | 走真接口抓两面板配置(reportQueryDialog / queryFields / columns / columnGroups) |
| `_v-gate.mjs` / `v-gate.out` | **回归闸**:20 项 —— 纯函数门控 + 两面板配置 + 编码/名称双口径取数 + 日期段 + 台账合成行 |
| `_v-dialog-flow.mjs` / `v-dialog-flow.out` | **时序回归**:14 项 —— 首次弹一次 / 弹窗开着不重开 / 查过不再弹 / 工具栏查询 / 切面板重置 |
| `_run-gate.mjs` | 把上面几个闸**同进程**跑一遍并以 UTF-8 落盘(PowerShell 的 `>` 会写成 UTF-16 乱码) |
| `_check-sfc.mjs` | 无构建工具时的 SFC 静态核(script 语法 + 模板引用名清单) |
| `_build-staged.mjs` | 用 `@vue/compiler-sfc` **in-process** 编译 PanelxList 的 script/template(沙箱里 esbuild 一律 `spawn EPERM`,`vite build` 跑不了;这是能拿到的等价证明) |
| `_shot-stock-reports-1020.mjs` / `_probe-dialog-1020.mjs` | CDP 实拍/实点脚本(**本机沙箱内 Edge 起不来**:`mojo platform_channel Check failed: 拒绝访问 (0x5)`;在正常终端跑才有用) |
| `_WhoHolds.cs` | 8090 端口占用者反查(P/Invoke `GetExtendedTcpTable`;本机 `Get-Process`/`Get-CimInstance` 在受限环境里看不见那个 java 进程) |
| `_stop-prod.bat` | 透传 `start-prod.ps1 -Stop` 的包装(隔离它偶发控制台缓冲区异常) |
| `重启系统-换新后端.bat` | **一键重启**:停实例 → 等 jar 句柄 → 换 build.jar → 启动 → 跑回归(双击即可,须在你自己的桌面会话里跑) |

复跑:

```powershell
cd D:\YINJIA-main
node tools/archive/_stockreport-dialog-1020/_v-dialog-flow.mjs        # 门控时序(不需服务)
node tools/archive/_stockreport-dialog-1020/_v-gate.mjs                # 需 8090 在跑
node tools/archive/_stockreport-dialog-1020/_build-staged.mjs          # SFC 编译(不需服务)
cd frontend; node src/core/report/reportQuery.test.js                  # 纯函数单测
cd ..\tools; set YINJIA_SQL_PASS=Yinjia@2026
java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_QVerify.java HSDZ_MES
java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_QVerify.java HSDZ_MES_TEST
```

## 三、验证结果与本机边界(2026-10-20)

| 项 | 结果 |
|---|---|
| 前端纯函数单测 `reportQuery.test.js` | **7/7 通过** |
| 门控时序回归 `_v-dialog-flow.mjs` | **14/14 通过**(重复弹窗的直接防线在此) |
| SFC 编译 `_build-staged.mjs`(compiler-sfc,script+template) | **通过** |
| 后端全量编译(`javac --release 25`,185 个 class) | **通过** |
| SQL 口径自检 `_QVerify.java`(两账套) | 编码精确 = 73 行、名称精确 = 120 行、**旧 bug 现场 = 0 行** |
| 接口回归闸 `_v-gate.mjs`(打的是**正在跑的旧 jar**) | 台账两项 **FAIL**(旧 class 就是 bug 本身);汇总全 PASS;前端门控 8 项全 PASS |

**跑不了的平台能力**(都已在探测里确认,不是"没做"):

* 无头 Edge:`[FATAL] mojo platform_channel Check failed: 拒绝访问 (0x5)`(沙箱不给 mojo 命名管道)⇒ 截图/点按脚本
  `_shot-stock-reports-1020.mjs`、`_probe-dialog-1020.mjs` 只能留档,需在正常终端跑;
* `vite build` / `npm run build`:esbuild 必须 spawn 子进程 ⇒ `spawn EPERM`(npm.ps1 也被执行策略挡);
* 杀 8090 那个 java 进程:`Stop-Process`/`taskkill` 均 `Access denied`(只能看见端口占用者 pid)。

### 部署状态:新后端 class 已就绪,但**没换上**(需在你自己的终端重启一次)

8090 上跑的仍是**旧 class 的旧 jar**(所以接口回归里台账那两项还会 FAIL,`_probe-ledger-filter.mjs`
的口径也没变)。新 class 已编好并打进 `backend/target/yinjia-mes-backend-0.1.0.build.jar`
(BOOT-INF/lib 128 条 / static 160 条 = 与原 jar 同构,只多换了 `BOOT-INF/classes/com/**`;
**static 一个字节没动**,本次改动的只有后端)。

> 🔴 为什么没直接重启:本会话是**受限沙箱**,对 8090 那个 java 进程(pid 32464)
> `Stop-Process`/`taskkill` 一律 `Access denied`(脚本报「已停止」但进程仍在,端口仍被占);
> `start-prod.ps1` 因此判定「已在运行」直接跳过启动 —— 沙箱里的"重启"对它是无效的。
> 你桌面会话里跑同一个脚本**有权限**,所以下面这个一键批处理是可靠路径。

**双击即完成重启**(停止 → 等 jar 句柄释放 → build.jar 换成正式 jar → 启动 → 自动跑回归):

```
tools\archive\_stockreport-dialog-1020\重启系统-换新后端.bat
```

它等价于手跑这三步:

```powershell
cd D:\YINJIA-main
powershell -ExecutionPolicy Bypass -File tools\scripts\start-prod.ps1 -Stop
cd backend\target
powershell -Command "Move-Item yinjia-mes-backend-0.1.0.jar yinjia-mes-backend-0.1.0.jar.orig1020 -Force; Move-Item yinjia-mes-backend-0.1.0.build.jar yinjia-mes-backend-0.1.0.jar"
cd ..\..
powershell -ExecutionPolicy Bypass -File tools\scripts\start-prod.ps1
node tools/archive/_stockreport-dialog-1020\_v-gate.mjs      # 期望 20/20 PASS(台账两项转绿)
```

> 换错了想回退:`backend\target\yinjia-mes-backend-0.1.0.jar.orig1020` 就是旧 jar,
> 停实例后改名回去即可。

前端静态产物(`frontend/src` → `backend/src/main/resources/static`)仍需在正常终端 `cd frontend; npm run build`
完成(本机 `vite build` 起不来),要么按 AGENTS.md 同步进 jar,要么直接用 5173 开发服务器看效果。
