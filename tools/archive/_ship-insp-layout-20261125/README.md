# 出货检验纸面(表观/功能)版面修复 —— 复跑证据(2026-11-25)

用户报障:出货检验表(`QC_ASM_INSP`,单号 `ZJ-2026-11-0015`,服务器账套)**填写完成后不显示批次号**,
且**各行格式不一致**;并要求「表格需实现可手动换行,且格式一致居中」。

根因与修法见 `docs/development/出货检验纸面-批次号消失与统一居中-20261125.md`。

## 怎么复跑

1. 起三层:`Docker Desktop`(mssql2019)→ `powershell -File tools/scripts/start-prod.ps1`
   (8090,顺带跑 DbSync)→ `frontend/start-vite.bat`(5173)。
2. 登录页「登录工厂」= **YINJIA-MES·测试库**(`HSDZ_MES_TEST`;本机无 `ZJ-2026-11-0015`,用测试库造同形状单)。
3. 用 `q5.sql` / `q11.sql` 的口径在测试库造单(或直接在界面里新增一张 → ＋新增检验项 ×3 → 填内容 → 保存)。
4. ego 脚本(按轮次,新文件不覆盖):
   - `round-04.mjs` 新建 + 加 3 项 + 填内容 + 把批号改成 `20281117`
   - `round-05.mjs` 保存为草稿(核 `qc_asm_insp_detail` 里 `\n` 是否原样落库)
   - `round-11.mjs` **改前**只读态取证(`已审核` 时表头只剩「批次号」,批号消失)
   - `round-22.mjs` **改后**录入态(批号输入框 `20281117`,五列居中,18px)
   - `round-23.mjs` **改后**只读态(表头 `批次号`+`20281117`,五列居中,`\n` 保留)
   - 其余 round-* 是排障过程(登录/页签/未保存拦截/选择器探针),留档备查。
5. 执行:`ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-insp-fmt-20261125/round-22.mjs')"`
   (脚本里路径写死为本机 ego 目录;拷回本目录即可复跑)。

## 截图

| 文件 | 含义 |
|---|---|
| `before-readonly-no-batch-no.png` | 改前 · 已审核(只读):表头只有「批次号」三个字,`20281117` 消失 |
| `after-editable.png` | 改后 · 草稿(录入):批号输入框有值,五列同一套居中/18px |
| `after-readonly-batch-no.png` | 改后 · 已审核(只读):「批次号」+`20281117` 都在,五列居中,手工换行保留 |

## 造数清理

测试库 `ZJ-2026-11-0012`(填过数据)、`ZJ-2026-11-0013`(空草稿)已删:
`qc_asm_insp_detail` 3 行 / `qc_asm_insp_head` 2 行 / `yj_doc_status` 2 行,残留 0(表头总数回到 446)。
号池 `s_allno` 消耗的 2 个 ZJ 号未回滚。
