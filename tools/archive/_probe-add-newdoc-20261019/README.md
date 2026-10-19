# 「点新增出来一张已审核单」根因与修复(2026-10-19)

用户报障原话:**送料暂收单 / 来料检验单点「新增」,出来的单子是已审核的**;并质疑"合并/改动没审核"。

结论:**不是前端合并出来的,也不是"新增复制了旧单"** —— 是**取号重发**:新草稿拿到的单号
库里**早就有一张已审核单**,两行共用一条 `yj_doc_status`(shr=admin),所以新单一出生就是已审核。

## 一、证据链(全部可复跑)

| # | 证据 | 命令/位置 |
|---|---|---|
| 1 | 列表 302 行,而 `sl_recv` 有 320 行 ⇒ 有 18 个单号被列表 `GROUP BY` 并掉了 | `DupProbe.java` |
| 2 | 重号明细:同一 `单据编号` 两行,一行是 9 月的真单(有供应商/明细),一行是今天 17:43~18:01 的空白头行 | `15-dups-full.sql` |
| 3 | `yj_doc_status` 里这些号 `shr=admin` ⇒ `docStatusOf` 推导为**已审核**(状态行按单号共用) | `06-pairs.sql` |
| 4 | 号池 `s_allno` 的 SL 末号只到 `SL-2026-10-0033`,库里最大号是 `SL-2026-10-0130`,`qc_insp` 101 张单号**一张都不在池里** | `09-map2.sql` / `DupProbe.java` |
| 5 | 下一张新增会发 `SL-2026-10-0034` —— 库里已有一张 9 月的已审核 `0034` | `17-next.sql` |

## 二、根因(代码)

`backend/src/main/java/com/yinjia/mes/service/FormNoService.java`

```java
// 改前:只扫号池自己
seq = MAX(CAST(RIGHT(dh,4) AS int)) FROM s_allno WHERE lb=前缀 AND ny=yyyy-MM AND dh LIKE 前缀-ny-%
exists(no) = 查 s_allno ∪ inh          // 都不看业务表
```

导库/金蝶导入/直接写库的单号**没进号池**,号池从旧号继续发 ⇒ 把库里已存在的号再发一次。
`saveDoc` 里 `clearStaleDocStatus(no)` 只在"业务表查不到这个号"时才清状态行,撞到真实存在的单 ⇒ 状态行照旧有效。

> 同类事故有前例:`01d31001`(2026-10-16)「导库补做号池回登」IJ 池末号 0010、库里已有 0011~0020,
> 造检验单连撞 10 个重号;本次是同一病根在**新增(directAdd)**上的表现。

## 三、修复

### 代码(`FormNoService.java`,已随 8090 重启生效)

1. 取号基准 = `max(号池末号, 各业务表同前缀同月最大号)` —— 一次跳过所有"未回登"的号;
2. 候选号逐个比对 **号池 + `inh` + 本前缀对应的业务表**(头行式查头表、单表式查行表,表/列取自 `yj_panel`);
3. `next()` 加 `synchronized`(同 JVM 两个页签同时新增不再算出同一个候选号);
4. 读不到表/列(元数据漂移)时跳过该表,不阻断开单,由逐号比对兜底。

### 数据(`tools/migrate-formno-pool-sync-20261019.sql`,两账套已执行)

- 清掉事故留下的**空白占位头行**(只删"同号多行里全字段为空"的那几行,**不碰明细行**);
- **号池回登**:逐面板把「前缀-yyyy-MM-nnnn」形态、池里没有的单号补登(只增不删);
- 末尾自检:空白重号=0、未回登=0,否则 `RAISERROR 16` FAIL。
- 已在 `tools/db-migrations.txt` 登记(幂等,新环境跑一遍无害)。

## 四、验证(都在这台机器上跑过)

```powershell
cd tools

# ① 体检:重号 / 号池缺号(两账套都必须 [PASS])
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_probe-add-newdoc-20261019\DupProbe.java HSDZ_MES
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_probe-add-newdoc-20261019\DupProbe.java HSDZ_MES_TEST

# ② 端到端:新增 → 状态=草稿 → 可保存 → 删除(池子落后时也能发出"库里没有的号")
node tools\archive\_probe-add-newdoc-20261019\_verify-add-newdoc.mjs QC_RECV
node tools\archive\_probe-add-newdoc-20261019\_verify-add-newdoc.mjs QC_INSP

# ③ 列表核对:0016~0032 恢复成 9 月那批真单(有供应商),不再是"空白+已审核"假象
node tools\archive\_probe-add-newdoc-20261019\_list-check.mjs QC_RECV
```

**实测结果**

| 项 | 修前 | 修后 |
|---|---|---|
| `DupProbe HSDZ_MES` | FAIL:QC_RECV 重号 18、QC_INSP 重号 2、号池缺号 386 | **[PASS]** |
| `DupProbe HSDZ_MES_TEST` | FAIL:号池缺号 389 | **[PASS]** |
| 新增送料暂收单 | 发 `SL-2026-10-0034`(库里已有、已审核)⇒ 显示已审核、保存 409 | 发 **`SL-2026-10-0131`**(号池只到 0033,但业务表到 0130 ⇒ 从 0131 起)⇒ 草稿、可保存 |
| 新增来料检验单 | 发 `IJ-2026-10-0001` 等(库里已有) | 发 **`IJ-2026-10-0191`** ⇒ 草稿、可保存 |
| 列表 0016~0032 | 空白行 + 已审核(两行并一行) | 9 月真单 + 真实供应商 + 已审核(本来的样子) |

> 验证用的三张单(`SL-2026-10-0131/0132/0133`、`IJ-2026-10-0191`)都走应用自己的「删除」清掉了;
> 列表里排在最前的几张**空白草稿**(`SL-2026-10-0008~0015`、`SL-2026-10-0033`、`IJ-2026-10-0001/0003`)
> 是用户反复点「新增」时**成功**建出来的(草稿、不是已审核),可用「删除」逐张清掉。

## 五、目录里有什么

| 文件 | 用途 |
|---|---|
| `DupProbe.java` | 全库体检:①重号面板 ②号池未回登(只查走号池的头行式单据面板) |
| `_verify-add-newdoc.mjs` | 端到端验证(新增→草稿→保存→删除) |
| `_list-check.mjs` | 列表核对(重号假象是否清掉、空白行是否只剩用户点出来的草稿) |
| `01~29-*.sql` | 定位过程中的取证 SQL(重号明细、号池/库最大号、下一张会发的号、列表 GROUP BY 行为) |
| `_rebuild-backend-only.ps1` | 只重打后端 class 的脚本(**不动前端 static**;`rebuild-prod.ps1 -SkipFrontend` 仍会把旧 dist 镜像进 static,实测删了 38 个前端 chunk) |
| `_patch_d7.py` | 把 `docs/development/开发与质量.md` 的 D7 条升级成本次事故记录的补丁 |
