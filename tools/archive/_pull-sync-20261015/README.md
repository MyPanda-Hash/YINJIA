# 拉取云端仓库 + 同步(2026-10-15 下午场)

> 本次任务:`git pull origin/main` → 合并 → 两账套 DbSync → 四单回归闸。
> 本目录是本次拉取的**一次性取证产物**(探针 SQL + 差异分类脚本 + 本文),随任务入库。

## 1. 拉取与合并

| 项 | 结果 |
|---|---|
| 远端新提交 | `5989fee6`(前端静态产物镜像重建)· `c8523abe`(docs:金蝶换账套 state.json 坑 + 迁移登记≠生效) |
| 本地先行提交 | `efd7b8f9`(库存报表三表取数优化)· `08a87f00`(静态产物)· `0171aa68`/`d32bd592`(留档) |
| 冲突面 | **只在 `backend/src/main/resources/static/**`**(构建产物):29 处 modify/delete + rename/delete + content |
| 处置 | 冲突按**远端**收口 → 用**本地源码**重新 `npm run build` + `robocopy /MIR` 镜像 → 单独 `chore:` 提交(产物必须由源码现算,不能手工择一) |
| 备份分支 | `backup-pre-pull-20261015`(= 合并前 main) |

> ⚠ 本机 `git fetch` 走 schannel 会报 `SEC_E_NO_CREDENTIALS`;`git -c http.sslBackend=openssl fetch` 正常
> (SqlRunner.java 头部记的"本机 Schannel 损坏"是同一台机器上的老毛病)。临时用 `-c` 覆盖,不改全局配置。

## 2. DbSync 红灯 → 修复(本次拉取唯一的功能性故障)

拉取后两账套 DbSync 首条即失败:`migrate-bs-inv-inspection-align-20261015.sql`
(远端 `c9e6f8b2` 的商品档案「来料检验」对齐脚本,自检 `[FAIL] bs_inv 对齐自检未过`)。

根因(见 `q-01`/`q-02`/`q-03`/`q-04` 与 `q-10` 取证):

| 事实 | 本机两账套 | 脚本自检要求 |
|---|---|---|
| `bs_inv.来料检验` 物理列 | 已有(nvarchar(10) NULL),旧计算列 `是否来料检验` 已删,列数 148 ✅ | 同 |
| INV 面板字段行 | **1 行**(id 7535,`来料检验`,detail/44,hidden=**0**) | `hidden=1`(服务器实测口径) |
| 参照库 `HSDZ_MES_RESTORE`(旧备份) | **2 行**:7535(hidden=0)+ 9414(hidden=1) —— 服务器那份是"重复行里藏着 hidden=1" | — |

⇒ 脚本 ③ 的 `UPDATE … WHERE col_name = N'是否来料检验'` 在**行已被改名**的库上匹配 0 行,
`hidden` 永远补不上、自检恒 FAIL、脚本永远登记不进 `yj_schema_log`(DbSync 卡死在这一条)。
**修法**:③/④ 的 WHERE 改成 `col_name IN (旧名, 新名)` —— 面板字段改名按**目标态收敛**,
否则"幂等"只是空话(脚本头注释同步补了这段事故说明)。
修复后两账套:`DbSync` **执行 0 / 跳过 472 / 失败 0** ✅,脚本自检「不符项 0 条」✅。

## 3. 四单回归闸:拉取前就已存在的漂移(已按用户口径回正)

`verify\FourDocAudit.java` 拉取后两账套 **FAIL 182 处**(两账套数字完全一致 ⇒ 与本次拉取无关)。
按文档 §8 重跑四步取证 → 文档 diff 155+/157−,用 `_v-fourdoc-order.cjs` 分类:

```
字段增删 0 · 内容改 0 · 开关位改 5 · 纯名次改 119
```

| 类别 | 证据 | 判定 |
|---|---|---|
| 名次 | 四单 `yj_field.seq` **全部是 10 的倍数**(171/54/70/34 行),基线是 195/680 这类手工值 | `saveHeaderPrefs`/`saveColumnPrefs` 的 `(i+1)×10` 重排 —— **UI「表头调整/表格调整」保存**留下的;迁移链里没有任何脚本动过这些 seq(最近的四单脚本都停在 10-09/10-14 且与基线一致) |
| 开关位 | 5 个字段 `hidden 0→1`(QC_RECV 查询区 供应商;表头 供应商/部门;明细 金额/税额) | 同一次 UI 保存里被取消勾选 |

**处置(用户 2026-10-15 拍板「回正到文档基线」)**:两账套跑
`DbSync.java run migrate-fourdoc-baseline-restore-20261008.sql` → 重跑 §8 →
文档 diff 只剩「登记日期」一行(字段与顺序**零差异**)→ FourDocAudit 两账套 **`[PASS]`**
(70/54/34/171 行,多出·缺失·内容变·名次不符 **全 0**;越界污染 0)。

> 教训与文档 §8 一致:**§四 顺序核验 12/12 ✅ 挡不住这类漂移**(库与后端下发同源),
> 只有「基线快照比对 + 文档 git diff」抓得住 ⇒ 拉取后先跑 `FourDocAudit` 是必要动作。

## 4. 文件清单

| 文件 | 用途 |
|---|---|
| `q-01-bsinv-check.sql` | bs_inv/INV 字段行逐条核对(自检 6 条逐项) |
| `q-02-inv-hidden-dist.sql` | INV 面板 detail 字段 hidden/visible 分布(判定 hidden=1 是否异常) |
| `q-03-inv-row-all-dbs.sql` | 各库 INV·来料检验 行对照 |
| `q-04-row9414-identity.sql` | 7535/9414 两行身份 + 来料检验数据分布 |
| `q-05-schemalog-recent.sql` / `q-06-schemalog-today.sql` | `yj_schema_log` 结构 + 当天执行过哪些脚本 |
| `q-07-purin-seq.sql` | 四单 seq 形态(10 的倍数) |
| `q-09-yjfield-time.sql` | `yj_field` 无时间戳列(故只能靠形态取证,不能靠时间定位) |
| `q-10-fourdoc-seq-across-dbs.sql` | 跨库 seq 形态对比(定位重排发生在本机备份之后) |
| `_v-fourdoc-order.cjs` | 基线 TSV vs 现役 dump 的**分类**差异(增删/内容/开关位/名次) |

用法(仓库根):
`node tools\archive\_pull-sync-20261015\_v-fourdoc-order.cjs`;
探针 SQL 走 `java -cp lib\mssql-jdbc.jar SqlRunner.java "<jdbc url>" yinjia <口令> <文件>`。
