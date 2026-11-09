# 转ERP「已转」提示修正 —— 取证与回归(2026-11-09)

用户口径(原话):

> 转erp按钮,已转erp的要弃审后,重新审核后才可以转erp,但是现在可以直接转erp会一直显示转erp执行成功,
> 应该需要已转的有已经转的提示。

## 一、到底是不是"重复推了"?—— 不是

已转单据再点「转ERP」时,服务端 `KingdeePushService.pushDocument` ① 的守卫**命中**并直接返回,
**没有向金蝶推任何东西**(金蝶侧不会多一张单)。实测抓到的接口响应(`round-06.mjs`,5173 → 8090):

```json
{"code":200,"message":"success","data":{
  "是否已转ERP":"是",
  "ERP单号":"CGRK-20261014-03407",
  "message":"该单据已转入ERP，不可重复转入"}}
```

但前端 `PanelxList.vue` / `PanelxForm.vue` 的通用分支**无条件** `ElMessage.success('「转ERP」执行成功')`,
不看这个 message ⇒ 用户看到绿色"执行成功",既不知道"其实没推",也看不到"要重转得先弃审再审核"。

## 二、判据(为什么不能只看 `是否已转ERP`)

推送**成功**时服务端同样回写 `是否已转ERP = 是`(`pushDocument` ⑥),所以前端**不能**拿这个字段判"已转过",
否则每一次成功推送都会被误报成"已转过"。只认服务端显式的 `already=true`(新版本),
过渡期老 jar 没有该字段时退化为认 `message` 里的「已转入ERP」。落地见
`frontend/src/core/views/erpOutcome.js`(纯函数 + 8 条 `node --test` 断言)。

## 三、改后回归证据

| 场景 | 结果 | 证据 |
|---|---|---|
| 5173(源码版,旧 jar 后端) | 黄色警告:`该单据已转入ERP（CGRK-20261014-03407）…请先「弃审」再「审核」` | `round-07.mjs` + `screenshot-5173-warning.png` |
| 8090(重打包版,新后端) | 同上;接口额外回 `"already":true` | `round-14.mjs` + `screenshot-8090-warning.png` |
| 英语界面 | `This document has already been pushed to ERP (CGRK-20261014-03407) and cannot be pushed again. To push it again, first un-approve it and then approve it again.` | `round-17~19.mjs`(日志;英文截图当次窗口被最小化,没抓成帧) |
| 未转单据推送成功 | 仍按原样弹成功(不回归) | `erpOutcome.test.js` 第 3 条断言 |

> 截图取证要点:Element Plus 的 toast 只亮约 0.4~3s,`page.screenshot` 常抓到已经离场的那一帧。
> 本目录的 `round-12/15/16.mjs` 用「预览帧 150/300ms 连拍 + 读 `getComputedStyle(el).opacity`」的办法才拍实
> (opacity=1 那一帧才是真图形)。`screenshot-8090-warning.png` 就是这样拿到的。

## 四、顺带查出的坑:`rebuild-prod.ps1` 会"假成功"(偶发)

当天重打包时,脚本一路打印「后端打包 OK / 产出 app.jar OK / 重启完成」,而磁盘上的 jar
**还是上一次的**(`LastWriteTime` 未变、class 里没有新加的 `already` 字段)⇒ 8090 重启后跑的还是旧代码,
界面表现"改了没生效"。

- **不是确定性的**:同一条 `mvn -q -s tools\settings.xml -f backend\pom.xml -DskipTests clean package`、
  同一目录,5 次里 2 次没换包却退出 0(mvn 用 `-X` 跑全量日志时反而每次都成功,像是外部文件锁/杀软扫描一类抖动)。
- **已加防线**(`tools/scripts/rebuild-prod.ps1` 的「换包自检」):jar 文件时间早于本次开工 ⇒ 先自动重打一次,
  仍不换包 ⇒ 直接失败,**不再拿旧包重启**。
- 复核方式:`Get-ChildItem backend\target\*.jar | Select Name,Length,LastWriteTime`;
  要看包里有没有新代码就用 `jar xf <jar> BOOT-INF/classes/com/yinjia/mes/service/KingdeePushService.class`
  再在字节里搜 `already`(本目录 `ErpFlagProbe.java` 只查库,不查包)。

## 五、顺带发现(未改,留待业务定夺):迁移链上有一条"自己过不了闸门"的脚本

重打包会顺带跑 `tools/sync-db.bat`,现在**每次启动**都报:

```
[新增] migrate-drop-bak-qc-snapshots-20261102.sql
[SQL失败] [中止] 闸门未通过,一张表都不删:① 名单外还有备份/临时表:[_bak_pc0000_20261018_inh],
  [_bak_pc0000_20261018_kucun], [_bak_pc0000_20261018_outh], [_bak_pc0000_baseline],
  [_bak_pc0000_merge], [kucun_bak_beforelot], [scjl_bak_20261021],
  [wo_process_line_bak_20261021], [yj_doc_status_bak_20261021];
=== 同步完成: 执行 0, 跳过 703, 失败 1 ===
```

- 该脚本**从未登记进 `yj_schema_log`**(`SchemaLogProbe.java` 可复核),所以每轮都被当"新增"重放,
  每轮都被自己的白名单闸门挡下(==它什么表都没删,是安全的==)。
- 影响:`DbSync` 遇到失败会**中止后续脚本**。它排在 `db-migrations.txt` 第 4480 行,
  后面还有 17 条(含 2026-11-06~11-09 那批)—— 那批**已经**在 `yj_schema_log` 里,所以眼下无影响,
  但**以后新增的迁移会排在它后面被挡住**。
- 处理方向(需业务先定):① 把上面 9 张 `_bak_*` 补进该脚本的白名单并让它真正删表;
  ② 或把它从迁移链上摘掉。**本次没动** —— 删备份表是不可逆操作,不该顺手做。

## 六、复跑方式

```powershell
# 只读探针:逐张单据头看 是否已转ERP 的实际落值/类型(两账套都可跑)
cd tools
java -cp lib\mssql-jdbc.jar archive\_erp-already-prompt-20261109\ErpFlagProbe.java HSDZ_MES
# 迁移链登记情况(第五节那件事)
java -cp lib\mssql-jdbc.jar archive\_erp-already-prompt-20261109\SchemaLogProbe.java HSDZ_MES

# 界面回归(ego 浏览器;脚本按 round-NN 顺序执行)
ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/erp-already-prompt-20261109/round-16.mjs')"
```

前置:8090/5173 在跑(见 `tools/scripts/start-prod.ps1`、`frontend/start-vite.bat`),
用 `admin/123456` 登录;被测单 `CGRK-20261014-03407`(采购入库单,已审核 + 已转,ERP单号同号)。
