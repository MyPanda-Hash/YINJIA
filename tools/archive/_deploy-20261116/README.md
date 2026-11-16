# 2026-11-16 部署取证（`deploy_src.py --ref fa357390c`）

对应台账 **#28**（`deploy/部署台账.md`）。服务器 `36.140.66.163`，WinRM 5985 + Basic。

## 一、执行了什么

| 步 | 命令（在 `deploy/winrm/` 下） | 结果 |
|---|---|---|
| ① 只读体检 | `python deploy_src.py --check` | 基线 = 台账 #27：jar `4987C3A3…` / 台账 826 / 入口 `index-BFp-lNTw.js` / built 2026-11-15 17:59:01 |
| ② 迁移（两账套） | `python run_migrations.py ../tools/migrate-sample-insp-module-20261116.sql` | `HSDZ_MES` ✅ `HSDZ_MES_TEST` ✅（各 2 行受影响，登记真实 SHA-256） |
| ③ 换 jar | `python deploy_src.py --ref fa357390c` | `ALL-OK`：jar `428F3DB4…`(93.7MB) / 入口 `index-U46CWk0M.js` / 台账 **827** / built 2026-11-16 16:47:50 |

环境变量（口令不落盘，单会话传）：

```bat
set YJ_WINRM_TRANSPORT=basic
set NO_PROXY=36.140.66.163
set YJ_SERVER_PASS=<服务器口令>
```

> 缺 `NO_PROXY` 时 pywinrm 会被本机系统代理截走报 `Code 502`。

## 二、只读复核（部署后）

```powershell
# 三条指纹
sqlcmd -S localhost -d HSDZ_MES -E -W -I -h-1 -Q "SELECT COUNT(*) FROM yj_schema_log"          -- 827
sqlcmd -S localhost -d HSDZ_MES -E -W -I -h-1 -Q "SELECT COUNT(*) FROM yj_panel"               -- 156
sqlcmd -S localhost -d HSDZ_MES -E -W -I -h-1 -Q "SELECT COUNT(*) FROM yj_field"               -- 5014
# 样品检验归组(按码点,避开控制台乱码):26679,21697,26816,39564 = 样品检验
sqlcmd -S localhost -d HSDZ_MES -E -W -I -h-1 -Q "SELECT panel_code,UNICODE(SUBSTRING(module_group,1,1)) FROM yj_panel WHERE panel_code IN ('SAMPLE_REG','INSP_COMMISSION')"
# 四单基线(应 = 337)
sqlcmd -S localhost -d HSDZ_MES -E -W -I -h-1 -Q "SELECT panel_code,COUNT(*) FROM yj_field WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN') GROUP BY panel_code"
# 无脏数据(本轮只读查看,未新建)
sqlcmd -S localhost -d HSDZ_MES -E -W -I -h-1 -Q "SELECT COUNT(*) FROM qc_insp_commission_head"   -- 1
```

## 三、界面取证（ego 浏览器，生产 8090）

| 脚本 | 验的什么 | 截图 |
|---|---|---|
| `ui/round-01.mjs` | 登录（admin/123456，工厂 YINJIA-MES=正式库）+ 侧栏层级 | `round-01-after-login.png` |
| `ui/round-02.mjs` | 检验委托单纸面三行合并 + `no-print` 按钮 | `round-02-insp-sheet.png` |
| `ui/round-03.mjs` | 收尾：回到我的桌面并交还页面 | — |

复跑方式（脚本内容不变，直接 import）：

```bash
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_deploy-20261116/ui/round-02.mjs')"
```

实拍结论：

- 侧栏 **「样品检验」= 一级模块**，紧跟「品质管理」、在「数据建模」之前（子项 送样登记表 / 检验委托单）；
- 纸面三行合并成立：「委托单位/单位地址」「制造商/地址」「生产厂/地址」，每行一格内 **2 个输入框**（名称 + 地址），数据键未合并；
- 「选择检验项目」按钮 class = `ic-pick-btn no-print`（打印/截图通道都不会上纸）；
- 纸宽 880px，列表 1 张既有单 `WT-2026-11-0001`（本轮未新建/未保存，HEAD 1 行 / DETAIL 6 行与部署前一致）。

## 四、本轮未做（有意剔除）

| 项 | 理由 |
|---|---|
| `migrate-merge-gen-20261113.sql` / `migrate-pu-order-price-wh-not-required-20261113.sql` 重跑 | 11-15 已在服务器执行过；本轮仅因 `552da9119` 修幂等性/守卫而字节变化，业务口径未变。避免二次触碰四单/采购单字段元数据 ⇒ 账本里这两条会一直显示「待重跑」，**不是漏跑** |
| `MANUAL-*` 占位哈希（约 35 行）改写真实 SHA-256 | 属独立任务（`DbSync baseline`），不与上线混批 |
| 全量恢复 / 清库 | 服务器已是生产账，常规增量即可；本次也没动 `kucun`/`inh`/`outh` |
