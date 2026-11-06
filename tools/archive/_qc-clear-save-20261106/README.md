# 取证:档案面板「把已有值删成空,保存后又变回原值」(2026-11-06)

## 报障(用户原话)

> 来料检验要求单独修改后保存,如果将已经写好的数据删除未空,保存会保存会原来的。
> 但是做修改的话就没有这种情况。

配图:来料检验要求 → 折叠棉 → `YJ-YCYX-020` 行 `实配炭棒后外径` 由 `9` 清空 → 点「完成」→ 点「保存」→
`[保存] 成功`,但该格又变回 `9`。**改成别的值再保存却存得住**。

## 根因(后端,一处)

`ButtonService.labelsToCols(fields, row)` 是为**插入**写的:它把空串经 `normalizeByType` 归一成 `null`
后**整列丢弃**(注释写着"否则 NOT NULL 列会被显式插 NULL 报错,交由 fillRequiredDefaults 补默认值")。
而**更新**走的也是这个法子 ⇒ 用户清空一格时,前端提交的是 `""`,后端归一成 null 后丢弃
⇒ 拼出的 `UPDATE ... SET` 里**根本没有这一列** ⇒ 库里原值原样留着。
改值之所以正常,是因为新值非空、不会被丢。

旁证(`yj_archive_change_log`):留痕里明明记着 `{"label":"折叠棉 YJ-YCYX-020 · 实配炭棒后外径",
"kind":"清空","old":"9","new":""}`(留痕是拿提交内容比的),而库里还是 `9` —— 留痕与落库对不上,
一眼就能看出"值到了后端但没进 UPDATE"。

## 修法

`backend/src/main/java/com/yinjia/mes/service/ButtonService.java`:

1. 新增重载 `labelsToCols(fields, row, boolean keepClearedAsNull)`:
   - `true`(更新口径):行里**带了**这一格但值是空(空串/null)⇒ 以 `null` 保留该列 = 显式写 NULL;
     NOT NULL 列由既有的 `dropNullsOnNotNull` 兜住(那些列收到 null 会被剔除、保留原值,不会报错)。
   - `false`(插入口径):原样(空值跳过,交给默认值)。
   - 判据是 `row.containsKey(label)`:**没带**这一格 = 没提交 = 不动库里原值
     (参照带回、只补缺失项这类局部提交不会被误清)。
2. 新增 `withoutNulls(cols)`:插入前把 null 剥掉,保持历史插入语义。
3. 三处**更新**路径改用更新口径:`upsertLineRows`(单据明细行)、`upsertHeadRow`(单据头)、
   `saveArchive`(档案行,本单报障所在)。

## 验证(8090 + **测试库**,不动正式库)

`round-23.mjs` / `round-24.mjs`,对象 = 测试库 折叠棉 `YJ-YCYX-006` 的「折数」:

| 步骤 | 界面 | 数据库 |
|---|---|---|
| 清空「折数」→ 保存 | 刷新后该格为空 | `折数 = NULL`(留痕 id=38 `清空 75±5 → ""`) |
| 还原「折数」= 75±5 → 保存 | 回显 75±5 | `折数 = '75±5'`(留痕 id=39 `补充 "" → 75±5`) |

清空前后都在 UI 上「刷新」重取过数据,不是只看本地状态;测试库数据已复原(现值 75±5),
误触的单据(`JYSJ-2026-10-0107` / `JYSJ-2026-10-0036`)核对过无残留。

## 踩坑记录(重建 jar 两次没生效)

`tools\scripts\rebuild-prod.ps1 -SkipFrontend` 连跑两次都打印「后端打包 OK / 产出 app.jar OK」,
但 **jar 里的 `ButtonService.class` 还是 10:28 那份**(不含 `withoutNulls`),SHA256 也没变 ——
也就是说源码改了、jar 没重打,重启后自然还是旧行为(第一次验证"清空没生效"就是被这个坑误导)。
判据不能只看脚本打印,要**直接看 jar**:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z=[System.IO.Compression.ZipFile]::OpenRead((Resolve-Path 'backend\target\yinjia-mes-backend-0.1.0.jar'))
$e=$z.Entries | ? { $_.FullName -eq 'BOOT-INF/classes/com/yinjia/mes/service/ButtonService.class' }
"entry time: " + $e.LastWriteTime     # 必须晚于源码修改时间
```

最后直接在 `backend` 下跑 `mvn -s tools\settings.xml -DskipTests clean package` 才成功
(带 `-q` 且设了 `YINJIA_M2_REPO` 的那次静默失败,`$LASTEXITCODE` 却是 0 —— 别只信退出码)。

## 没做的事(说明清楚,避免误判)

- **单据头/明细行**的清空路径用的是同一个 helper,本次一并修了,但没有在 UI 上逐面板验证
  (测试库那几张草稿单要么 0 明细被「请至少添加一行明细」拦下,要么该单不渲染「处理意见」格)。
  下次发版后可以随手验一张:把某单据的「处理意见」清空 → 保存 → 刷新,应为空。
- **生产服务器 36.140.66.163 未部署**(按用户决定等下次正常发布)。本次只重启了本机 8090。

## 本轮脚本

`round-21`(误在正式库试,未写任何数据)、`round-22`(切测试库 + 改值/清空/还原)、
`round-23`(清空并刷新取证)、`round-24`(还原 + 单据头尝试)、`round-25/26/27/28/29/30/31`(单据头定位与受阻取证)。
截图 `round-22.png`、`round-23.png`、`round-27.png`、`round-30.png`(png 按仓库 .gitignore 不入库)。
