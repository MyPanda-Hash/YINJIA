# _other-pick-20261116 — 手机扫码 · 其他领料 / 其他退料

任务用户口径(2026-11-16):

> 「手机端再做一个其他领料和其他退料,其他领料关联其他入库单,其他退料就还是按生产退料来。
>  其他领料和退料都是直接扫物料二维码进行的。扫完几个二维码后,可以点提交。
>  就生成了,之后重新扫就是另一个单据了」

## 三问确认(下单前的口径定稿)

| 问题 | 用户选择 |
|---|---|
| 其他领料落哪张单 | **其他出库单 OTHER_OUT(OO-,扣库存)** —— 原话里的「其他入库单」是口误,领料是领出仓库 |
| 其他退料的业务类型 | **生产退料**(与手机生产退料一致,靠"没有工单号"区分) |
| 页面形态 | **只要扫码 + 提交**(不做已提交列表;提交后清空,接着扫就是另一张单) |

## 实现落点

| 文件 | 作用 |
|---|---|
| `frontend/src/views/mobile/MobileOtherScan.vue` | 一页两入口:`side=pick` 其他领料 / `side=ret` 其他退料(路由 props 钉死) |
| `frontend/src/business/scanOther.js` | 纯逻辑:单据/业务类型映射、清单合并键、数量校验、两种 formData |
| `frontend/src/router/index.js` | `#/panelx/list/MOBILE_OTHER_PICK`、`#/panelx/list/MOBILE_OTHER_RET`(必须排在 `:panelCode` 之前) |
| `frontend/src/business/menus.js` | 手机扫码 → 生产扫码登记 下新增两个叶子,紧跟「生产领料」 |
| `frontend/src/i18n/locales/*.js` | 10 个语言包 × 18 条新词条(脚本 `_gen-other-scan-i18n-20261116.mjs` 批量写入) |

**没有改后端**:落库全程走通用面板引擎 `/px/callButton(panelCode=OTHER_OUT|MATERIAL_RET, buttonName=保存)`,
与「扫码领料」(`views/scm/ScanPick.vue`)同一条路。菜单叶子挂的是**目标单据的面板码**,
不另开页面级虚拟码 —— 当前工作区还有别的任务未提交的后端改动,不走「改 PagePanelRegistry + 重编 jar」这条重路;
将来要独立权限时补 `MOBILE_OTHER_PICK` / `MOBILE_OTHER_RET` 两个页面码即可。

## 实测过的链路(测试账套)

| 场景 | 结果 |
|---|---|
| 其他领料:扫 `HP-08` 2 件 + 再扫 3 件 | 合并成**同一行 5 件**(同物料/批号/仓库)→ 提交得 `OO-2026-11-0005` |
| 其他领料:再走一单 1 件 | `OO-2026-11-0006`,单头「经手人 = 系统管理员」 |
| 其他退料:扫 `HP-08` 4 件 | 提交得 `TL-2026-11-0007`(业务类型=生产退料、工单号为空) |
| 其他退料:扫**无库存**的 `C-53-02` | 走商品档案兜底补名称/规格/单位 → 手选「华北工控仓」→ 2 件 → `TL-2026-11-0008` |
| 未选仓库时 | 「加入清单」**禁用**(避免退到空仓) |
| 提交后 | 清单清空、扫框聚焦,接着扫即新单 |

## 踩到的坑(写进代码注释了)

1. **档案类面板返回的是分组结构**:`INV`/`WH`(mode=archive)的 `data.list` 是
   `[{编号, 状态, detail:{ inv:[行…] } }]`,行埋在 `detail[表别名]` 里 ——
   按平表 `res.list[0]` 取会拿到分组头,名称/规格/单位全 undefined(界面只剩「· — · —」)。
   已抽 `archiveRows(res, alias)` 统一摊平。
2. **`condition` 对档案面板不生效**:改用 `keyword` 检索 + 前端按存货编码**精确**过滤
   (档案编码存在 `M-001` / `XM-001` 这种前缀包含,模糊匹配会领错料)。
3. **表单键必须用面板标签**:`OTHER_OUT` 明细的批号列 label 是**批次号**(物理列才叫 批号)、
   `MATERIAL_RET` 明细是**材料编码**(不是存货编码)。`ButtonService.save` 按 `labelToCol` 取值,写错键该列静默丢值。
4. **tt() 按原文全等查词条**:带单号的动态串查不到译名 ⇒ 成功提示拆成
   `tt(键) + '：' + 单号`(见 `scanOther.doneMessageKey`)。
5. ego 的 `page.evaluate(fn, arg)` 本环境会 `Illegal invocation`,一律改用**表达式字符串**形式。

## 复跑

```powershell
ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/start-system-20261110/round-19.mjs')"
# round-18 其他领料(累加+提交) / round-19 其他退料(正常路径+兜底) / round-20~21 兜底选仓
# round-22 导航+英文 / round-23 导航叶子顺序 / round-24 8090 打包版
```

`probe/q*.sql` = 取证查询(面板字段/标签、档案与库存结构、落库复核)。

## 单测

`node --test`:1858 项全 PASS(新增 `scanOther.test.js` 8 项 + `menus.test.js` 结构断言同步)。
