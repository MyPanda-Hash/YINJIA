# 首件检验单·抬头长值(产品型号)换行 — 取证 20261029

## 用户口径(2026-10-29)

> 当前首件检验单中的内容超出当前行无法实现自动换行
> (截图红框 = 抬头「产品型号」,值是 `32*12*112.2序号:Z045物料编码:T123`,被格线裁掉只剩半句)

## 根因

`frontend/src/core/qc/QcFirstInspSheet.vue` 抬头四对(`.fi-head`)的值格是**单行 `el-input`**:
拾头格宽按 `table-layout: fixed` 平摊只有 ~105px(实测 `clientWidth=88`),
而值 `scrollWidth=215` ⇒ 文本横向溢出被格线裁掉,行高恒 35px,永远不换行。

实测(改前,docNo=SJ-2026-10-0167):`ctl=INPUT  cw=88  sw=215  ch=22  sh=22  td.h=35`

## 修法

1. 抬头值格控件 `el-input` → `el-input type="textarea" :autosize="{minRows:1,maxRows:4}"`
   ⇒ 文本在**本格内换行**,行高随内容长高。
2. 样式补换行规则(无空格长串也要断):
   `.fi-head td .fi-cell :deep(.el-textarea__inner) { word-break: break-word; overflow-wrap: anywhere; ... }`
   以及只读态 `.fi-head td > span { word-break: break-word; overflow-wrap: anywhere; }`。
3. 打印字号规则补 `.fi-head .el-textarea__inner`(与 `.fi-head .el-input__inner` 同为 10px)。

实测(改后,同一单据):`ctl=TEXTAREA  ch=55  sh=55  td.h=66`(3 行完整显示,无横向裁切)

## 取证文件(图片本地留档,不入库)

> ⚠ `*.png` 在本仓库 `.gitignore` 里(截图不入库),下面三张图只在本机该目录留档;README/探针脚本入库。
| `_before-full.png` | 改前整页(1600×1200):产品型号被裁成 `32*12*112.2序` |
| `_after-full.png` | 改后整页:产品型号 3 行完整显示 |
| `_compare-head-row.png` | 抬头行放大对比(上=改前,下=改后) |
| `_probe-first-insp-head.cjs` | 复现/取证探针(入库;Edge headless CDP:登录→打开单据→量 `.fi-head` 几何→截图) |

探针用法(需后端 8090 + 一个静态服务器;本次用 `.tmp/_serve.cjs` 把 `frontend/dist` 反代到 8090):

```bash
# 1) 起 Edge(headless CDP)
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" \
  --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9372 \
  --user-data-dir=%TEMP%\yj-edge-<随机> about:blank
# 2) 量几何 + 截图
node _probe-first-insp-head.cjs 9372 SJ-2026-10-0167 _after.png http://127.0.0.1:5180
```

## 验证记录

- `node --test`(frontend):1111 条,1106 通过;5 条失败全部是 `recordSheetConfigs.livedb.test.js`
  的「活库 RD_ archive 面板」用例(与本次改动无关,改前即红)。
- 改后 8090(打补丁后的 jar,只换 `BOOT-INF/classes/static`,不动 class)实测:
  抬头值格 `TEXTAREA`、行高 66px、`scrollHeight == clientHeight`(不裁切)。
