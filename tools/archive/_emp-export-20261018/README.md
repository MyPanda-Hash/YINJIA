# 职员档案 → Excel 推送云端仓库(2026-10-18)

用户口径:「将职员的数据打包成 excel 推送到云端仓库」。

## 为什么是脱敏版

推送前核实:`MyPanda-Hash/YINJIA` 是**公开仓库**——未登录访问
`https://github.com/MyPanda-Hash/YINJIA` 返回 **HTTP 200**(标题「GitHub - MyPanda-Hash/YINJIA: 银嘉公司」),
对照一个不存在的仓库返回 404。取证脚本:`_probe-repo-visibility.mjs`。

而 `bs_emp`(面板 EMP「职员」)里有 **130 行真实姓名 + 35 个手机号 + 8 个证件号码 + 8 个办公电话**
⇒ 用户当场选定「**脱敏后推送**」:手机/办公电话留前 3 后 4、证件号码留前 4 后 4、邮箱账号名留首字符、微信留首末字符。
**未脱敏原值不出本机**,也不进 git 历史(公开仓库的历史无法撤回)。

## 本目录文件

| 文件 | 作用 |
|---|---|
| `_export-emp-xlsx.mjs` | 导出器。读 `HSDZ_MES.dbo.bs_emp` + `yj_field`(面板 EMP) → 写 `db/emp-data-20261018/职员档案-20261018.xlsx`;写完**回读自检** 8 项(页签/行数/表头/顺序/PII 残留),任一 `[FAIL]` 直接 exit 1 |
| `_verify-xlsx.mjs` | 独立复核:事后另开文件,打印页签/表头/脱敏样例 + 再做一遍 PII 残留扫描(与导出器互为独立证据) |
| `_probe-emp-stats.mjs` | 统计口径取证:各脱敏列/部门/性别的非空行数(README §三 的数字来源) |
| `_probe-repo-visibility.mjs` | 仓库可见性取证(公开仓库判据) |

## 复跑

```powershell
node tools/archive/_emp-export-20261018/_export-emp-xlsx.mjs      # 生成 + 自检
node tools/archive/_emp-export-20261018/_verify-xlsx.mjs          # 独立复核
```

## 2026-10-18 两次踩坑(留档)

1. **PII 扫描假阳性**:首版扫描用裸 `\d{17}`,把金蝶 19 位雪花号 `外部数据ID`
   (`2178314889490196480`)的子串判成身份证号 → `[FAIL]`。改成带数字边界的
   `(?<!\d)\d{17}[\dXx](?!\d)` 后 0 处。**别为了过闸把扫描放宽,要收紧匹配边界。**
2. **PowerShell 5.1 改中文文件必定写坏**:本机 `pwsh` 实为 Windows PowerShell **5.1.19041**,
   `Get-Content -Raw` 按 ANSI(GBK)读 UTF-8 文件、`Set-Content -Encoding utf8` 再写回 ⇒ 整篇变
   「瀵煎嚭銆岃亴鍛樻…」乱码,且空行被吞。**改含中文的文件一律用编辑器/edit 工具,不用 shell 做文本替换**
   (参见 `docs/development/开发与质量.md` §5.5「PS 命令通道 CJK」)。
