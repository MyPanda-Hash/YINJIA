# 采购入库单「来源」提示 —— 界面取证(2026-11-11)

用户口径两轮:

1. 「采购入库单在表头最末尾,加一个来源(可能是直接暂收来的,可能是检验单来的,也可能是特采来的)和显示对应的单据编号。」
2. 「**不要做成字段,做成个按钮或者是提示就行**」← **最终形态**

## 最终形态(第二轮)

表头**不再占格子**,改成单据号旁边一条可点的小提示:

```
单据: PI-2026-11-0001   批次号: 20261009   来源: 来料检验单 IJ-2026-10-0064   草稿
```

点它直接翻到那张来源单据(暂收单 / 检验单 / 特采单)。

| 取证 | 说明 |
|---|---|
| `r25-list-hint.png` / `r29-list-final.png` | **列表页表头条**:表头字段到「到期日」为止(来源两格已撤),提示挂在本单号后面 |
| `r27-form-hint.png` | **单据表单页**:同样撤格,提示挂在单号右侧 |
| `r26-jump-source.png` | 点提示后跳到 `#/panelx/form/QC_INSP?code=IJ-2026-10-0064`(标题 `IJ-2026-10-0064 已审核`) |
| `r28-list-hint-en.png` | 切 English:`Source: Incoming inspection IJ-…`,`Click to open the source document: IJ-…`(显示名翻译、数据值不翻) |
| `r30-asm-no-chip.png` | **不串面板**:`ASM_BOM` 的「来源」是**可见**字段,该面板不挂重复提示(判据 `hasHiddenSourceColumn`,有单测) |

## 第一版(字段形态,已按第二轮口径改掉,留档)

| 取证 | 说明 |
|---|---|
| `r04-recv.png` / `r05-insp.png` | 暂收直达 / 检验入库两张单:表头末尾两格显示 来源 + 来源单号 |
| `r14 / r15 / r16` | 界面上「审核」`IJ-2026-10-0064` → 自动生成 `PI-2026-11-0001`,来源 = 来料检验单、来源单号 = IJ-2026-10-0064(**写入口径生效的实证**,第二轮只是把它从格子改成提示,写入逻辑没变) |
| `r19-new-pi-en.png` | 字段形态下的 en 显示名(`Source` / `Source Order No.`) |

## 脚本(按轮次)

```powershell
ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/purchase-in-source-20261111/round-17.mjs')"
```

- `round-04` 直接开表单(`#/panelx/form/PURCHASE_IN?code=<单号>`)并 dump 表头 label+value(第一版取数)
- `round-08 / 09 / 10` 来料检验单「审核」:审核在 **审批** 分组的下拉里,确认按钮文案是「确认审核」
- `round-13 / 19` 语言切换器是 `.locale-switch`(el-dropdown),要**真实点击** `page.click('.locale-switch')`
- `round-15 / 16 / 17 / 18` 第二轮验证;**踩坑**:前端有 cfgCache,改完 yj_field 必须 `page.reload()` 整页重载,否则表头还是旧字段表

## 备注

- **截图不入库**(仓库 `.gitignore:134 *.png`):上面那些 `r*.png` 在
  `C:/Users/Lenovo/ego/purchase-in-source-20261111/` 里;**入库的只有复跑脚本**(本目录 `round-*.mjs`)。
- 账套 = **YINJIA-MES·测试库**(`HSDZ_MES_TEST`);正式库只做只读的字段/数据核对,未造单。
- 验证在测试库留下:1 张由检验审核自动生成的入库单 `PI-2026-11-0001`(草稿)+ `IJ-2026-10-0064` 的审核留痕 —— 测试库可弃。
- 语言已切回「简体中文」。
