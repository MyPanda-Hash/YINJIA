# 生产退料 · 改成「扫码到明细行再扫物料码退料」(与生产领料/扫码混料对齐)· 验证证据

任务:用户口径「生产退料也要扫码到明细行再扫物料码退料,要和(扫码混料一样)对齐生产领料。」

设计说明与结论:**`docs/development/生产退料-手机扫码作业.md`**。

## 环境

- 前端源码版 `http://localhost:5173`(vite)、打包版 `http://127.0.0.1:8090`(jar 内 static,本轮已重新发布);
- 登录:`admin` / `123456`,登录工厂 **YJ_TEST = 测试库**;
- 样例单据:`LL-2026-11-0006`(台账号 id=823,工单 `GD-2026-10-0217 #10`,3 项料,已退 1 个);
- 浏览器:ego lite(task space `return-doc-20261118`)。

## 脚本(可复跑)

```powershell
ego-browser nodejs -e "await import('file:///<本目录绝对路径>/round-01.mjs')"
```

| 脚本 | 做了什么 |
|---|---|
| `round-01.mjs` | 列表页:版面、可退单据分组、「可退合计」 |
| `round-02.mjs` | 点一行进**单据明细页**:抬头 + 3 行明细(已领/已退/本次退) |
| `round-03.mjs` | 扫**不在本单**的料(必须拒绝)+ 扫本单料解锁(可退 9)+ 确认 4 |
| `round-04.mjs` | 第二项确认 2(合计 6)→「清空本次」验闸门 → 重新录入 |
| `round-05.mjs` | 提交 → 生成 `TL-2026-11-0013`,已退/退料单号刷新(打印打桩) |
| `round-06.mjs` | 手机竖屏 390×844:两页无横向滚动、解锁区在屏内 |
| `round-09.mjs` | 再退一项 → `TL-2026-11-0014`;验证**提交后提示不被刷新冲掉** |
| `round-10.mjs` | 8090 打包版复核两页(入口 chunk `index-CSDNs0aM.js`) |
| `round-11.mjs` | 从「生产领料」已完成单点「去生产退料」→ **一跳直达**退料明细页 |

> round-07 是 round-09 的前一次尝试:确认弹窗点击时序偶发失败(ego 报协议错、单没提交、库里无残留),
> 重跑即成功 —— 保留两者以便对照排障;`round-08.mjs` 是那次失败后的现场状态检查。
>
> ⚠ 5173 是共用 dev 服务器,验证期间另一个会话在改别的页面,页面上残留过空的 `vite-error-overlay`
> (会吞指针事件)⇒ 脚本里先 `remove()` 再点击,**不改被测代码**。

## 截图

`round-01-list.png`、`round-02-doc.png`、`round-03-unlock.png`、`round-03-confirmed.png`、
`round-04-cleared.png`、`round-04-ready.png`、`round-05-confirm-box.png`、`round-05-submitted.png`、
`round-06-mobile-list.png`、`round-06-mobile-doc.png`、`round-06-mobile-unlock.png`、
`round-09-submitted.png`、`round-10-8090-list.png`、`round-10-8090-doc.png`、`round-11-jump.png`。

## 数据取证

| 文件 | 内容 |
|---|---|
| `01-returnables.sql/.out.txt` | 测试库里可按工单退料的候选单(已完成 + 材料出库单已审核)与各物料的已领/已退 |
| `02-verify-return.sql/.out.txt` | 本轮提交出来的 `TL-2026-11-0013`(生产退料,2 行:热缩袋 4 个 / 标签 2 张)+ 台账 `wo_pick_return` + 已领/已退/可退对照 |
| `03-cols.sql/.out.txt` | `bd_material_ret` / `wo_pick_return` 列清单(取证 SQL 的字段依据) |
| `check-i18n.mjs` | 两个页面 `tt()` 词条对 en/ja 的覆盖检查(结果:各缺 0 条) |
| `add-i18n.mjs` | 本批 en 32 条 / ja 35 条译名的插入脚本(幂等;含"别把词典里已有的双引号串改坏"的教训注释) |

## 结论摘要

- 两页结构:列表页(查询 + 扫码定位 + 可退单据分组)→ 明细页(**扫物料码解锁对应的明细行**);
- 「确认」把数量记在该行上(覆盖),底栏「提交退料」一次生成一张生产退料单并补打印;
- 提交闸门 = 本次退料合计 > 0(退料是**部分退**,与领料"每行都要有数量"不同);
- 后端**零改动**:全部复用 `/returnables`、`/locate`、`/doc`、`/returnScan`、`/submitReturn`,
  硬闸门仍是"已完成 + 材料出库单已审批";
- 手机端实测:两道拒绝闸门(扫错料 / 空提交)都给出可读提示,库里台账与页面数字一致。

> 验证期间在**测试账套**产生两张退料单:`TL-2026-11-0013`(6)、`TL-2026-11-0014`(1),保留作样本。
