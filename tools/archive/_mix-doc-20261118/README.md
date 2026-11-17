# 扫码混料·第四轮(两页结构 + 解锁/确认/提交闸门)· 验证证据

任务:把「扫码混料」改成与「生产领料」**同一套两页结构**(用户 2026-11-18 口径:
「应该和生产领料一样也是跳转到单据的明细里面再开始扫物料码,解锁对应的物料码,
然后根据连接电子秤的取数,点击确认……全部物料确认完毕后,才可以提交。设计要和生产领料一致」)。

设计说明与结论:**`docs/development/扫码混料-20261118.md` §七**。

## 环境

- 前端源码版 `http://localhost:5173`(vite)、打包版 `http://127.0.0.1:8090`(jar 内 static);
- 登录:`admin` / `123456`,登录工厂 **YJ_TEST = 测试库**(正式库 `mate` 物料清单 0 行,没有可投的料);
- 演示数据:工单 `GD-2026-11-0015` 行 1(产品 A-45-01,排产 1002;物料清单 2 项 86.172 / 21.042 kg);
- 浏览器:ego lite(task space `mix-doc-20261118`),脚本原样拷自 `C:/Users/Lenovo/ego/mix-doc-20261118/`。

## 脚本(可复跑)

```powershell
ego-browser nodejs -e "await import('file:///<本目录绝对路径>/round-01.mjs')"
```

| 脚本 | 做了什么 |
|---|---|
| `round-01.mjs` | 打开列表页:版式、分组、「未完成」卡片 |
| `round-02.mjs` | 展开「已完成」;按工单号「打开单据」→ 进明细页(抬头 + 2 行应投) |
| `round-03.mjs` | 扫**清单外**物料(必须拒绝)+ 扫本单物料(解锁后出现数量框) |
| `round-04.mjs` | 两项物料逐个 解锁 → 手输秤值 → 确认;看进度 1/2 → 2/2 与提交闸门 |
| `round-05.mjs` | 提交并打印(本机无打印机 ⇒ `window.print` 打桩)→ 只读明细 + 补打印 |
| `round-06.mjs` | 手机竖屏 390×844:两页无横向滚动、解锁区与按钮都在屏内 |
| `round-07.mjs` | 接口级:只确认 1 项 → `/px/mix/save` 必须 409(缺项点名);撤回;两组列表 |
| `round-08.mjs` | 口径级:同物料先 30 再 80 ⇒ **覆盖为 80**(不是 110);纸面取数 17 列 |
| `round-09.mjs` | 改完标题/「上次混料单」后复看(列表展开 + 未完成抬头 + 只读抬头) |
| `round-10~13.mjs` | 8090 打包版:入口 chunk、正式库会话报错、切测试账套后的列表页 |
| `round-14~18.mjs` | 手机竖屏下**已确认行**的版面:曾发现行内「撤回本项」压住 应投/实投 ⇒ 去掉该按钮(确认即覆盖,与生产领料一致),round-18 复看并清理验证数据 |
| `round-19.mjs` | 最终发布产物(8090 `index-BmtHM9TK.js`)复核:标题「混料单」/「上次混料单」/ 无行内按钮 / 提交置灰 |

> ⚠ 5173 是共用 dev 服务器:验证期间**另一个会话**在改 `MobileLabRecord.vue`,页面上残留过一个空的
> `vite-error-overlay`(吞指针事件)⇒ round-18 起脚本先 `remove()` 该浮层再点击,**不改被测代码**。

## 截图

`round-01-list.png`、`round-02-list-done.png`、`round-02-doc.png`、`round-03-unlock.png`、
`round-04-first-confirm.png`、`round-04-all-confirmed.png`、`round-05-confirm-box.png`、
`round-05-submitted.png`、`round-06-mobile-list.png`、`round-06-mobile-doc.png`、
`round-09-mobile-done.png`、`round-09-mobile-doc.png`、`round-09-mobile-saved.png`、
`round-10-8090-doc.png`、`round-13-8090-list.png`。

## 数据与接口取证

| 文件 | 内容 |
|---|---|
| `01-survey.sql/.out.txt` | 正式库 `wo_mixing_list` 28 列、0 行;`mate` 0 行;`plang` 429 行;`MIX_SCAN` 权限词 20 个角色 |
| `02-counts.sql/.out.txt` | 同上计数核对(行数/mate/角色) |
| `03-testdb-survey.sql/.out.txt` | 测试库:`mate` 134 行 / 27 产品、A-45-01 两行;BOM 与工单行、混料记录分布 |
| `04-verify-doc.sql/.out.txt` | 本轮提交的 `PL2611170001` 两行(标记 Y、批号、计划/实际用量、打印次数 1);该工单行无残留草稿 |
| `check-i18n.mjs` | 两个页面的 `tt()` 词条对 `en.js`/`ja.js` 的覆盖检查(结果:各缺 0 条) |

## 结论摘要

- 扫物料码 = **只解锁**(后端 `POST /px/mix/scanMaterial` 校验物料清单,不在清单里直接拒绝并列出应投编码);
- 「确认」= 覆盖写入(`POST /px/mix/scan`),同一物料再确认以最后一次秤值为准;
- **全部物料确认完毕才可提交**:前端按钮按 `mixProgress().ok` 置灰,后端 `saveDoc` 再按物料清单校一遍(409 点名缺项);
- 提交后自动打印并跳到只读明细(可补打印);列表页「未完成 / 已完成」两组与生产领料同形态。
