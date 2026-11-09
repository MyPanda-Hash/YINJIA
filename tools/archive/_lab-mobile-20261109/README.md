# _lab-mobile-20261109 —— 「实验室记录手机登记」任务取证

> 任务:手机扫码 → 实验室记录手机登记(3 张研发记录表的手机端:拍照上传 + 填字段 + 模糊查询 + 回填电脑端)
> 说明文档:`docs/development/实验室记录手机登记-实现与验证.md`
> 迁移脚本:`tools/migrate-lab-mobile-20261109.sql`

## 目录内容

| 文件 | 内容 |
|---|---|
| `q1-panels.sql` / `q1.out.txt` | 三个面板在 `yj_panel` 的登记(模式 doc、头表/明细表、前缀 SW/EU/IU) |
| `q2-fields.sql` | 三个面板的 `yj_field` 全量(表头 4 列 + 明细若干;标准库字段 `lab.test_item/lab.device/lab.instrument`) |
| `q3-schema.sql` / `q3.out.txt` | 头表/明细表物理列(加列前的 35 列基线)+ 已有 `data_type='附件'` 字段清单 |
| `q4.sql` / `q6.sql` / `q11.sql` / `q12.sql` | 加列前后核对(`COL_LENGTH`、列数 35→36、`yj_field` 3 条、`yj_translation` en) |
| `q9.sql` | 手机端建单后的落库取证:head(`手机照片='test-photo.png'`)/ `yj_attachment` 行 / 明细行 |
| `q-config-equip.json` | `GET /px/getPanelConfig?panelCode=RD_EQUIP_USE` 的下发(含新增的「手机照片」附件字段) |
| `q-newform-equip.json` | `GET /px/getNewFormPermMatrix`(`meta` 表头字段 + `detail.tabs[0].fields` 明细字段 + 默认值) |
| `q-doc.json` | `GET /px/getFormDescriptor`(已有单据回填形状:`data` + `detailData.items[]` 带 id) |
| `q-list*.json` | `POST /px/queryFormDataList` 的返回(表头字段 + `detail.items` + 单据状态) |
| `ego/round-*.mjs` | ego 浏览器走查脚本(每轮一个独立文件,可单跑:需先 `cd` 到仓库根、5173 起着) |
| `ego/round-08.png` | 手机页打开既有单据 → 表头/明细回填 |
| `ego/round-10-staged.png` | 新单选了照片 → 「待上传」预览排队(新单还没单号) |
| `ego/round-13-saved.png` | 保存成功 → 单号 EU-2026-11-0003、照片自动上传、列表出现 📷 1 |
| `ego/round-48-mobile-search.png` | 模糊查询「拍照联调」→ 3 条收敛到 1 条 |
| `ego/round-50-pc-strip-fixed.png` | **电脑端同一面板**第 1/3 张单纸面上方出现「手机照片:test-photo.png」附件条(回填闭环) |
| `ego/round-51-spikewater.png` | 加标水面板手机页(21 个明细字段)渲染正常 |

## 复跑要点

1. 服务:`tools/scripts/start-prod.ps1`(8090)+ `frontend/start-vite.bat`(5173);界面验证用 5173。
2. 账套:走查在**测试库**(YJ_TEST)上做,正式库只做只读核对 —— 测试数据 `EU-2026-11-0001..0003`
   与 `test-photo.png` 只落在 `HSDZ_MES_TEST`。
3. 脚本里的 `localStorage` 会话按「测试库」走;换账套要重新登录(切换账套对话框需要目标库密码)。

## 没做/边界

- 「测试申请单 RD_DOM_TEST」不做手机端(三页签的申请单据,用户确认不在本次范围)。
- 手机端**不送审**:保存=草稿,电脑端照原流程「提交审批 → 审批通过」。
- 纸面附件条只覆盖「元数据里有、纸面配置没写」的附件字段;`recordSheetConfigs` 里显式声明
  `{type:'file'}` 的字段仍走原格子(如产品信息表·客户图纸)。
