# 其他退料「退到仓库」可自选(2026-11-19)

## 用户口径

> 「手机扫码的其他退料,改为可以选择退料的仓库。」

改动前:只有**库存里查不到这个物料**时才出现「退到仓库」下拉;库存查得到就固定用库存行的仓,
现场没法改。改动后:其他退料**扫到物料就出下拉**,默认带库存行所在的仓,随时可改成别的仓。

## 改了什么

| 文件 | 改动 |
|---|---|
| `frontend/src/business/scanOther.js` | 新增三个纯函数:`toWarehouseOptions`(档案行→下拉项,排掉停用仓)、`defaultWarehouseCode`(默认仓 = 库存行仓库)、`withWarehouse`(把选的仓盖到候选行,**仓库名称 + 仓库编码** 一起换) |
| `frontend/src/views/mobile/MobileOtherScan.vue` | `showWh`(= 退料恒真 / 领料只在库存行无仓时出现)、退料进页预拉仓库档、手选粘住(`whTouched`)、加入清单用选中的仓、候选卡在退料页把「仓库」改叫「库存仓」以免与「退到仓库」混淆、仓库档没拉到时给提示 |
| `frontend/src/business/scanOther.test.js` | 新增 4 条纯逻辑单测 + 2 条页面守卫(文案必须有英文译名、退料必须始终有下拉) |
| `frontend/src/i18n/locales/{en,ja,zh-TW}.js` | 补 `库存仓`、`仓库档案没加载出来，请返回重进`;顺带补齐本页此前漏译的 `加入清单`、`还没有扫码加入的物料`、`该批号可用量为 0` |

## 为什么「停用仓」要排掉

`bs_wh` 实测 15 个仓,其中 6 个 `停用=1`(原料仓 CK01 / 辅料仓 CK02 / 成品仓 CK03 / 半成品仓 CK04 /
不良品仓 CK05 / 辅料及配件区A仓 CK-A2),它们在 `kucun` 里**结存全为 0**;在用的 9 个
(D仓 / C仓 / A仓 / 原料不良品仓 / 华北工控仓 / 恒亿仓 / 成品不良品区 / 成品B仓 / 车间仓)才是实仓。
探测脚本:`_ProbeWh.java`(bs_wh)、`_ProbeWhUse2.java`(kucun 按 ckdm 的结存与停用对照)。

## 实测证据(ego 浏览器,脚本 + 截图同目录 `ego/`)

复跑:`ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/other-ret-wh-20261119/round-0N.mjs')"`
(脚本已拷到本目录 `ego/`,路径按需改)。登录 `admin/123456`,**登录工厂 = YINJIA-MES·测试库**。

> 截图 `*.png` 按仓库 .gitignore 只留本地、不入库(脚本 `.mjs` 入库可复跑)。

| 轮次 | 做了什么 | 结果 |
|---|---|---|
| round-01 | 测试库登录 → 打开 `#/panelx/list/MOBILE_OTHER_RET` → 扫 `YJ-CH-016` | 标题「其他退料」;候选卡 `库存仓：华北工控仓`;`退到仓库` 出现,默认 `华北工控仓` |
| round-02 | 把下拉改成 `原料不良品仓` → 加入清单 | 清单行 `标签 YJ-CH-016 · 无批次 · 原料不良品仓`(不是库存仓) |
| round-03 | 再扫同一条料 → 列全下拉选项 → 提交 | 下拉**粘住** `原料不良品仓`;选项 9 个、**停用仓 0 个**;提交得 `TL-2026-11-0019` |
| round-04 | 其他领料页同样扫一条 | **没有**「退到仓库」栏(领料仍从有货的仓出);候选卡标签是「仓库」不是「库存仓」 |
| round-05 | 真实点开下拉截图 | 打开态 9 个仓,无停用仓 |
| round-06 | 8090(打包版)复检 | 入口 chunk `assets/index-ocazD-QA.js`(= 新包);下拉与默认值一致;只扫码**未提交** |

提交后果(测试库)核对:`_ProbeDoc.java HSDZ_MES_TEST TL-2026-11-0019`

```
行1 | YJ-CH-016 标签 | 仓库=[CK00005]原料不良品仓 | 批号=null | 数量=2.0000 | 扫码其他退料
```

—— 落库的是**现场选的仓**(CK00005),不是库存所在的 CK00006,与需求一致。

## 造数清理(已执行)

`_CleanupDoc.java HSDZ_MES_TEST TL-2026-11-0019`(库名不对直接拒绝执行):

```
已清理 TL-2026-11-0019: 明细 1 行 / 头 1 行 / 状态 1 行 / 修改留痕 0 行
复核 PASS:残留 0 行
```

## 单测

```
cd frontend && node --test src/business/scanOther.test.js   # 14 条全绿
cd frontend && node --test                                  # 2191 条全绿
```

## 重新打包(用户「重新打包」,2026-11-19 二次)

走的是仓库标准全量路线 `tools\scripts\rebuild-prod.ps1`(停 8090 → 等句柄 → 前端 build + static 镜像
→ `mvn clean package` → fat jar 自检 → 重启),自检全过:

| 项 | 值 |
|---|---|
| 部署产物 | `backend\target\app.jar`(93.8 MB)+ `backend\target\yinjia-mes-backend-0.1.0.jar` |
| app.jar SHA256 | `19289B08A6165CC9638A6715DFFA7688A79433A2D953A03C240118B66F8E78D0`(旧 `80B87672…`) |
| fat jar 自检 | `BOOT-INF/lib = 129` 条(≥50 才算 fat jar) |
| 换包自检 | jar 已被 mvn 重写(16:42:11) |
| 8090 下发入口 chunk | `assets/index-CT4iOomQ.js` |
| 复检 | 其他退料页「退到仓库」默认 `华北工控仓`,与打包前一致(ego round-06 复跑) |

> 入口 chunk 哈希从 `index-ocazD-QA.js` 变成 `index-CT4iOomQ.js`,原因只是
> `MobileOtherScan.vue` 那条注释改动换了分包哈希、入口引用了它(功能无变化)。

## 遗留 / 与本次无关但发现的现象

跑 `tools/scripts/apply-frontend-only.ps1` 时,`start-prod.ps1` 的增量同步里
`tools/migrate-qc-proc-insp-batch-table-20261111.sql` 的 §7 自检**失败**(出货检验功能记录表批次矩阵),
该脚本来自提交 `6f3502bae`(另一个任务),本次未改动任何 `tools/*.sql`,与「其他退料选仓库」无关 ——
仅记录现象,未处理。
