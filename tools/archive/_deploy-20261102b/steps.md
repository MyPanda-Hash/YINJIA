# pkg-incr-20261102b — 只换 jar 的热修包（两个真实缺陷）

> 执行手册：`deploy/部署说明.md` §二 B　·　台账：`deploy/部署台账.md`（本次部署后必须追加）

## 1. 为什么有第二个包

`pkg-incr-20261102`（12:29 上线的那个）跑通后，验收当场暴露两个缺陷，都在代码里、都不动库：

1. **烧结工艺清单责任人存不了单（阻断级）**
   该面板的产品编号带 `-tb` 后缀（`A-54-12-tb`），而 `rd_dev_task` 存的是原始编号（`A-54-12`）。
   后端四文件编辑门禁直接拿带后缀的值去查 ⇒ 查不到 ⇒ 判成「尚未分发责任人」⇒ 只有管理员能存。
   实测：服务器 4 张已存单全部 `A-54-12-tb`，其 `RD_MOLD_PROC` 负责人都是 `liulei`（刘磊本人）。

2. **销售端测试申请单的单据编号折成两行**
   该页编号格只占最后 1 列（92px），原来印 6 位受控表单号够用；2026-10-29 起改印 15 位单据号
   （`DT-2026-10-0002`）⇒ 必然折行。

## 2. 本包做了什么

| 项 | 值 |
|---|---|
| 类型 | **只换 jar**（`GO APP`）：不备份库、不跑迁移、不改任何表 |
| app.jar | 合并后源码重打，内嵌前端入口见下方 SHA 段 |
| 前端变更 | `recordSheetConfigs.js` RD_DOM_TEST 销售端页 `noSpan 1→2 / noGapSpan 4→3`（编号格 92px → 196px，左边缘对齐「文件管理员」） |
| 后端变更 | `DevTaskService.baseProductCode/productCodeForms` + 8 处读取点归一化；`ButtonService` 门禁与漂移判定；`RdDevProductService.nodeOf` |
| 闸 | `npm test` 1425 通过 0 失败（含新增 10 条钉子） |
| to-run | 6 条（沿用上个包；`GO APP` 不执行迁移，仅作 preflight 的存在性校验） |

## 3. 服务器操作（管理员 cmd，在解压后的包目录）

```cmd
deploy-production.bat            rem 只读体检
deploy-production.bat GO APP     rem 只换 jar：停机 → 换包 → 启动 → 登录验证
```

预期 `RESULT:` 序列：`PACKAGE-OK` → `PREFLIGHT-OK` → `APP-STOPPED` →
`NEW-JAR-IN-PLACE` → `APP-STARTED` → `LOGIN-OK` → **`ALL-OK`**
（`GO APP` 跳过 `BACKUP-GATE-PASSED` 与 `MIGRATIONS-OK`，这是设计如此。）

## 4. 验收判据

- 用 `liulei`（刘磊）登录 → 打开 `RD_MOLD_PROC` 里 `A-54-12-tb` 的单 → 红条应消失、「保存为草稿」可点、能存住；
- 同上那张单的编号格：`DT-2026-10-0002` 一行显示，左边缘与「文件管理员」对齐；
- `admin` 仍能存（管理员兜底未被放宽或收紧）。

## 5. 回滚

```cmd
copy /y C:\yinjia\backup\app-<部署时间戳>.jar C:\yinjia\app.jar
schtasks /end /tn "YINJIA-MES" & schtasks /run /tn "YINJIA-MES"
```

库无需回滚（本包不动库）。
