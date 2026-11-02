# 快速排产「已排产」列表补 产品编号 / 品名 / 型号(2026-10-21)

## 用户口径(原话)

> 「快速排产看不到已排单的型号,当前需要增加对应的产品还有规格型号需要增加」

截图:②③「全部已排产」列表只有 生产线/排产班组/加工单号/工单行号/批次号/生产状态/数量/日期/计划线,
看不出**排的是哪个产品、什么规格**;而上面①待排产池本来就有 产品编号/品名/型号。

## 改动(1 后端 + 1 前端,**零库变更**)

| 位置 | 改动 |
|---|---|
| `backend/.../service/ScheduleBoardService.java` `today()` | SELECT 增加 `ISNULL(p.dm,'') AS 产品编号` / `ISNULL(p.mc,'') AS 品名` / `ISNULL(p.gg,'') AS 型号`;关键字查询同时匹配 `p.gg`(按型号找行) |
| `frontend/.../plan/ScheduleBoard.vue` ②③表 | 在 批次号 之后插入三列(与①池同名同值);整套列宽收紧(见下),让 1920 屏下 计划线 不被整列挤出 |

- **无数据库改动**:`SCHEDULE_BOARD` 是**页面级虚拟面板**(实测 `yj_panel` 行数 = 0,无 `yj_field`),
  列全在 Vue 模板里 ⇒ 不需要字段登记、不需要迁移脚本、不需要双账套执行(见 `_ProbeMeta.java` 输出)。
- **译名复用**:`产品编号` / `品名` / `型号` 三个标签在①池已在用,en 静态包已有
  (`Product No.` / `Item Name` / `Model`),本次不新增词条。
- 型号取 `plang.gg`(`gg2` 是「产品规格2」,银嘉单规格口径全链路不用)。

### 列宽收紧(为什么动了老列)

加三列后表宽 1502 → 1882 px,1920 屏可视区 1674 ⇒ 「计划线」整列被挤出。收紧后 **1717 px**:

| 列 | 原 | 现 |
|---|---|---|
| 加工单号 | 150 | 130 |
| 批次号 | 100 | 90 |
| 产品编号(新) | — | 100 |
| 品名(新) | — | min 130 |
| 型号(新) | — | 120 |
| 生产状态 | 90 | 80 |
| 排产数量 / 需求数量 | 95 | 85 |
| 入库数量 | 95 | 80 |
| 余量 | 85 | 75 |
| 预开工日 / 预完工日 | 105 | 90 |
| 计划线 | min 240 | min 220 |

`工单行号` 保持 90(70/80 时表头「工单行号」+ 排序箭头会折成两行,表头行变高)。

## 验证

| 探针 | 结果 | 覆盖 |
|---|---|---|
| `_ProbeToday.java`(直连正式库跑 today() 原 SQL) | 全通过 | 新列有值;按型号/产品编号/品名/「工单号#行号」各自命中;today/all 两模式 |
| `_api-sched-prod-cols.mjs`(8090 接口) | **11/11** | 每行都带三字段;按型号片段能筛;产品编号老口径未破;pending/today 不受影响 |
| `_probe-sched-cols.mjs`(CDP 界面,8090) | **13/13** | 列头顺序(批次号→产品编号→品名→型号→生产状态);数据行有值;①池未受影响;切「全部」后列宽 1717 ≤ 可视 1674+60;英文列头 = Product No./Item Name/Model 且无中文残留 |

截图:`sched-cols-table.png`(②全部已排产 表体)、`sched-cols.png`(整屏)、`sched-cols-en.png`(英文)。

复跑(仓库根):

```bash
node tools/archive/_sched-prod-cols-20261021/_api-sched-prod-cols.mjs
node tools/archive/_sched-prod-cols-20261021/_probe-sched-cols.mjs
```

> 探针坑:只改 hash 导航不会重载 pinia(仍是「未登录」内存态)⇒ 会被守卫弹回 /login 再到 /dashboard;
> 用 `?r=<ts>#/prod/plan/scheduleBoard` 强制新文档加载。headless=new 下 `--window-size` 不生效
> ⇒ 必须 `Emulation.setDeviceMetricsOverride` 定视口,否则截图只有 500×320。

## 服务状态

`tools/scripts/rebuild-prod.ps1` 重建后已重启 8090(前端打进 jar,`BOOT-INF/lib` 128 条,胖 jar 自检通过;
`app.jar` = 91.1 MB),5173 dev 亦已即时生效。

## ⚠ 顺带发现的打包卫生问题(未改脚本,建议另行处理)

本轮**连续重建 4 次**后发现 `app.jar` 每次 +0.7 MB:`build-appjar.ps1` 只跑 `mvn package`(无 `clean`),
而 Maven 拷资源**不删**上轮已不在 dist 里的文件 ⇒ `target/classes/static` 累积了 **475 个文件 / 28 MB**
(dist 只有 129 个 / 7 MB),陈旧 hash chunk 全被打进 jar。

- 现象:95.4 → 96.1 → 96.8 → 97.5 MB 逐次变大(反例:本次先删 `target/classes/static` 再包,回到 **91.1 MB / 129 个静态文件**)。
- 佐证:`backend/target/classes/static` 曾累积到 **475 个文件 / 28 MB**(dist 只有 129 个 / 7 MB)。
- 影响:部署包无谓变大,且把废弃前端文件带上服务器;功能无影响(没人引用旧 chunk)。
- 根治候选(待拍板):① `build-appjar.ps1` 打包前 `Remove-Item target\classes\static -Recurse -Force`,
  或 ② 改用 `mvn clean package`(代价是全量重编译)。

