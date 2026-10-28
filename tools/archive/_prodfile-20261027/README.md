# _prodfile-20261027 —— 「1027 系统使用-产品工艺文件问题点待改善」取证与验证

用户口径来源:2026-10-27 反馈截图《1027系统使用-产品工艺文件问题点待改善》共 11 条。
本批实施 **#1 #2 #3 #4 #5 #7 #8 #11**(#6 文本截断需现场确认、#9 userScripts 非本系统、#10 打印待定)。

## 目录内容

| 文件 | 用途 |
|---|---|
| `_q-fields.sql` | 查 `RD_MOLD_PROC` / `RD_PROD_INFO` 的 yj_field 元数据(参照/下拉/标准库/alias) |
| `_q-prodinfo.sql` | 查产品信息表表头字段 + `mold.*` 标准库条目数 |
| `_q-cols.sql` / `_q-stdlib-schema.sql` | 探 `yj_field` / `yj_std_lib` 的列结构(驱动报"列名无效"时定位用) |
| `round-01..18.mjs` | ego-browser 活体验证轮次(构建产物 4173 → 登录 → 面板 → 建单 → 数行) |
| `out-*.json` | 各轮实测输出(页签顺序 / 表头名 / 配方表行数 / 下游接口 200 等) |

## 关键实测结论(可复核)

| 项 | 证据 |
|---|---|
| **#1** 页签顺序 | `out-02.json` / `out-06.json`:`["成型工艺清单","成型配方","修订记录"]` |
| **#1** 子区块重编 | 配置实测 `sections pages=[0,1]`、`tailSections=[1]`、`dataTables 修订记录@page2 / 配方表@page1` |
| **#3/#4** 表头改名 | `out-06.json`:`hasCtrlLevel=true, hasCtrlType=false, hasForm=true, hasOldForm=false` |
| **#3/#4** 参照下发 | `panelconfig-raw.json`(round-09 落盘于 _scratch):`"dataName":"外观要求","displayName":"产品形态","dataType":"参照","refPanel":"RD_PROD_INFO","refField":"产品形态"` |
| **#8** 10 行空行 | `out-08.json`:配方表 `trs=13` / **带 ＋× 操作格的数据行 = 10** / 合计行 = 1 |
| **#2** 后缀真实落库 | HSDZ_MES_TEST `MP-2026-10-0002` → `产品编号 = wqedqw-tb`(round-15 + /tmp SQL 回查) |
| **#2** 历史单据不报错 | `out-12.json`:`wqedqw` 与 `wqedqw-tb` 调 `specByProductForMold` 都是 `status=200 code=200` |
| **#5** 多行序号进包 | round-18:`RecordSheetPanels-Dn6VT7CP.js` 内含 stripSeq / 换行归一实现 |

## 复跑方式

```powershell
# 1) 构建产物起静态服务(验证用的是构建产物,不是源码热更)
cd frontend; npx vite build; npx vite preview --port 4173 --strictPort

# 2) 跑某一轮(注意 ego-browser 需要 taskSpace 未被占用)
cd _scratch\ego-prodfile-1027; ego-browser nodejs < round-10.mjs
```

⚠ 验证建单用的是**测试账套 YJ_TEST**,不在正式库造数据。
⚠ 正式库只跑了迁移 `migrate-mold-proc-ref-prodinfo-20261027.sql`(改 yj_field 元数据,不动业务表数据)。
