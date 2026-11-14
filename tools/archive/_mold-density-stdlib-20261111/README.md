# 烧结工艺清单「密度管控·管控要求」接入标准库 —— 验证证据（2026-11-11）

用户口径：「把烧结工艺清单面板的密度管控的管控要求字段加入标准库，可以自行维护更新」；
追问「实际密度管控范围 两个区域是不变动的 还是手动输入密度值供计算」→「就这样做」：
① 管控要求挂标准库（可选预设、也可手填）；② 实际密度管控下限/上限保持手填（计算只吃这两格）。

## 复跑方式

```bash
cd _scratch/ego-yj-density-20261111
~/.local/bin/ego-browser nodejs < round-07.mjs   # 打开 RD_MOLD_PROC 的密度管控下拉，打印候选并截图
```

- `round-06.mjs`：只探测 DOM（密度管控要求 那格有没有 `.el-select` / `.rs-lib-btn`），不点开下拉。
- `round-07.mjs`：点开下拉，打印全部 `.el-select-dropdown__item`，截图 `07-density-dropdown.png`。
- 两个脚本都用 API 登录（`admin/123456`，factory `YJ`）后把 token 写进 localStorage 再 reload ——
  登录页的 el-select 用脚本点选不稳（踩过：工厂没真正选中时后端只回「用户名或密码错误」）。

## 截图里看什么（07-density-dropdown.png）

1. 「密度管控 → 管控要求」那格现在是**下拉**（placeholder 仍是「密度范围：~」），下方挂「⧉ 标准库维护」；
2. 展开的候选正好 3 条：`密度范围：0.55~0.64` / `0.58~0.60` / `0.59~0.62`（= 迁移脚本的种子）；
3. 右边两格「实际密度管控下限 / 上限」仍是**普通输入格**（没有下拉、没有标准库字样）—— 用户口径「两个区域不变动」。

## 未覆盖

- `HSDZ_MES_TEST`：本机（macOS）只有 `HSDZ_MES`，测试账套在 Windows 开发机/服务器上，
  迁移只在本机正式账套执行过（脚本幂等，到 Windows 侧按 `tools/db-migrations.txt` 补跑即可）。
