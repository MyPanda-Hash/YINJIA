# 商品「是否过程检验」开关控制三张过程检验单自动生成(2026-11-14)

## 一、用户口径(原话)

> 「为现在的生产过程检验增加一个设置在商品中,针对当前的首件检验,出货功能检验,出货检验表观三个单据
> 作为当前生产工单的三个过程检验作为实现。简单来说就是将当前存在这个选择是否检验的商品进行确定是否
> 走过程检验流程,但是如果那个工单需要被手工新增检验单也是可以手动新增的,就是自动生成不进行了。」

追问默认值后,用户拍板:**默认「否」** —— 迁移后自动出单先停,需要自动出单的商品逐个改成「是」。

## 二、做法

| 层 | 改动 |
|---|---|
| 库 | `bs_inv` +`是否过程检验` bit NULL,默认约束 `DF_bs_inv_是否过程检验 DEFAULT (0)`;存量 3899 行回填 0;列级 `MS_Description`。**bs_inv 列数 148→149** |
| 元数据 | `yj_field`(INV / detail / `是否` / seq 46 = 规格型号后、计价方式前 / 可见可编)+ `yj_translation` 10 语种字段译名。商品面板列表自动出现该列,点格即开关(与 是否可采购 同一套渲染),保存走档案「只提交改动行」 |
| 代码 | `QcInspAutoService.build()`(报工审核 + 手机端报工吸收两个入口共用)入口加商品开关闸:**只有 = 是才自动出单**;否 / NULL / 商品档案查不到该编码 = 不出单,回执带原因串。异常(列未迁移等)按旧行为出单兜底,不阻断报工 |
| 手工入口 | **不动**:`QcFirstInspController` / `QcProcInspController` / `QcAsmInspController` 的「选生产工单」建单不经过该闸 —— 与用户口径「手工新增照旧」一致 |

迁移脚本:`tools/migrate-inv-process-inspection-20261114.sql`(两账套已执行,`DbSync run` 各 `[OK] 8 batches`,复跑幂等)。

## 三、边界(刻意不做 / 需要知道的)

1. **只管自动生成**,不拦手工建单;商品设「否」后仍可从三张检验单面板「选生产工单」手工建单。
2. 生产工序进度看板的「应检/待检验」提示**未改**:它按工序推导,与是否自动出单无关;
   开关=否时看板仍提示品质检验(默认值=否 ⇒ 上线后看板会出现「待检验但没单」的提示,需要手工建单或后续再收口径)。
3. 「工单自动结案」仍按既有口径要求「出货检验表观已审核 + 入库≥排产」;
   开关=否的商品要自动结案,需手工建/审一张出货检验表观(或走人工结案)。
4. 既有「来料检验」(文本 是/否,采购链分流)与历史「是否检验」bit 字段不动。

## 四、验证证据(可复跑)

### 1) 库 + 元数据(两账套)

```bat
cd tools
set YINJIA_SQL_DB=HSDZ_MES
"%JAVA_HOME%\bin\java" -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-inv-process-inspection-20261114.sql
set YINJIA_SQL_DB=HSDZ_MES_TEST
"%JAVA_HOME%\bin\java" -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-inv-process-inspection-20261114.sql
```

结果:两账套各 `[OK] 8 batches`,复跑 `[OK] 8 batches`;`bs_inv.是否过程检验` = bit / 默认 `(0)` / 3899 行全 0 无 NULL;
`yj_field` 1 行、译名 10 语种、列注明齐全(脚本末尾自检 `[PASS]`)。

### 2) 自动出单闸(只读探针,直接调生产代码 `QcInspAutoService.build`)

探针:`ProcInspGateProbe.java`(本目录)。编译/运行(仓库根目录,JAVA 用 JDK25):

```bash
J="$USERPROFILE/.jdks/ms-25.0.4/bin"
# Windows 的 classpath 分隔符是「;」;bash 里必须整串加引号
CP="backend/target/classes;$(cat backend/target/cp.txt)"
"$J/javac" -encoding UTF-8 -cp "$CP" -d .tmp/probecls tools/archive/_inv-proc-insp-20261114/ProcInspGateProbe.java
"$J/java" -Dstdout.encoding=UTF-8 -cp ".tmp/probecls;$CP" ProcInspGateProbe HSDZ_MES_TEST 2258 1256 1254 1086 1085 251
```

- 开关=否(默认):组装/成型/切炭三条报工**全部不出单**,原因=`商品「XX」「是否过程检验」未设为是,按商品设置不自动生成检验单…` —— 见 [probe-flag-off.txt](probe-flag-off.txt)。
- 把 `D-01-21`/`C-75-35`/`S022-4`/`T270` 置「是」后:切炭流入组装 → `QC_ASM_INSP`;成型当天首笔 → `QC_FIRST_INSP`、累计达计划量 → `QC_PROC_INSP` —— 见 [probe-flag-on.txt](probe-flag-on.txt)(三张单类型全覆盖;验完全部改回「否」)。
- 正式库只读复核:4414/4415/4397 全为「否」⇒ 均不出单(见同一 txt 末段)。

### 3) 手工新增不受影响(测试账套 YJ_TEST,开关=否)

```bash
node tools/archive/_inv-proc-insp-20261114/verify-manual.mjs
```

结果:首件检验单「选生产工单」候选 17 行、`POST /api/qc/firstInsp/fromWoLine` 返回 `SJ-2026-11-0008`(新建成功);
出货检验表观「选生产工单」候选 18 行。取证单据验后已用 [cleanup-manual.sql](cleanup-manual.sql) 连头/明细/状态/占用链清理(head/detail/doc_status/flow=(0,0,0,0))。

### 4) ego 浏览器界面(8090;测试账套 YJ_TEST 做写操作,正式账套 YJ 只查看)

| 轮次 | 判据 | 结果 |
|---|---|---|
| round-02 | 登录工厂选 `YJ_TEST` | ✅ 登录后 `mes_factory.code=YJ_TEST` |
| round-03 | 商品面板列头含「是否过程检验」、存量行为「否」 | ✅ 截图 `round-03.png`(本地) |
| round-08 | 第一行 `C-110-04**TB` 点格 → 开关「是」→ 保存 | ✅ 提示「保存成功」、单元格回显「是」、库内该行 =1(截图 `round-08.png` 本地) |
| round-09 | 刷新回显「是」→ 改回「否」保存 | ✅ 截图 `round-09-persisted-yes.png`(本地);库内回 0 |
| round-10 | 正式账套(YJ)查看 + 切英文 | ✅ 中文列头「是否过程检验」(截图 `round-10-yj-zh.png`);英文列头 `Process Inspection`(截图 `round-10-yj-en.png`);均本地 |

脚本:[round-02.mjs](round-02.mjs) / [round-03.mjs](round-03.mjs) / [round-08.mjs](round-08.mjs) / [round-09.mjs](round-09.mjs) / [round-10.mjs](round-10.mjs)
(运行:`ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/inv-proc-insp-20261114/round-08.mjs')"` —— ego 脚本运行时目录是 `C:/Users/vigna/ego/<task>/`)。

> ⚠ 按仓库 `.gitignore`「截图一律不入库」(用户口径 2026-10-15),本目录只入库脚本/文本证据;
> 上述截图留在本地 `C:/Users/vigna/ego/inv-proc-insp-20261114/`,可照脚本复跑重拍。

### 5) 回归体检

`tools/verify/DbNormAudit.java` 两账套:FAIL 数量与本次改动前一致(正式库 3:存量 02/09/12;测试库 7:存量 02/09/12/13 等),**无新增 FAIL**。

## 五、环境与部署状态

- 后端已 `mvn -o clean package`(JDK25)重打包,`tools/scripts/start-prod.ps1` 启动 **8090**(正式账套),服务保持运行。
- 本次**无前端源码改动**(列/开关全部由 `yj_field` 元数据驱动)⇒ 未跑 `npm run build`、未同步 `backend/src/main/resources/static`。
- 正式库只有本次迁移(全部商品 = 否),没有勾任何商品为「是」、没有建任何检验单;测试库的开关夹具与手工取证单已还原/清理。
