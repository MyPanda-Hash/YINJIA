# -*- coding: utf-8 -*-
"""
生成《数采设备台账-联网设备导入.md》:把 xls 里「是否联网 = 是」的数据整理成可读清单,
与 tools/migrate-dc-device-import-20261019.sql 同源(同一套展开规则),避免手抄出错。

用法:python tools/archive/_dc-device-import-20261019/_gen_doc.py
"""
import io
import os
import xlrd
from collections import Counter

XLS = r'C:\Users\x1787\OneDrive\Desktop\副本副本生产设备列表统计(2026)(1).xls'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..',
                   'docs', 'development', '数采设备台账-联网设备导入.md')

RULES = [
    ('注塑机', '注塑机'), ('机械手', '机械手'), ('干燥机', '干燥机'),
    ('拌料机', '加工设备'), ('内绕机', '加工设备'), ('高周波', '加工设备'),
    ('移印机', '加工设备'), ('超声波', '加工设备'), ('灌胶机', '加工设备'),
    ('锁螺丝机', '加工设备'), ('压铸机', '加工设备'),
    ('液压式高度调节板', '公用设备'), ('空压机', '公用设备'), ('冷水', '公用设备'),
    ('冻水', '公用设备'), ('风机', '公用设备'),
    ('喷油线', '产线'), ('煲机线', '产线'), ('流水线', '产线'), ('拉线', '产线'),
    ('组装线', '产线'), ('生产线', '产线'), ('老化', '产线'),
    ('隔音', '隔音设施'), ('静音', '隔音设施'), ('包装机', '包装设备'),
    ('测试', '检测设备'), ('检测', '检测设备'), ('仪器', '检测设备'),
    ('电脑', '办公终端'), ('平板', '办公终端'),
]


def dev_type(name):
    for k, v in RULES:
        if k in name:
            return v
    return '其他'


def s(v):
    if v is None:
        return ''
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v).strip()


def main():
    sheet = xlrd.open_workbook(XLS).sheet_by_index(0)
    rows, all_units = [], 0
    for r in range(1, sheet.nrows):
        c = [s(sheet.cell_value(r, i)) for i in range(7)]
        if not c[1] or c[0] in ('合计', ''):
            continue
        all_units += int(float(c[4] or 0))
        if c[6] != '是':
            continue
        rows.append({'no': c[0], 'name': c[1], 'maker': c[3], 'qty': int(float(c[4] or 0)),
                     'digital': c[5], 'networked': c[6]})

    units = sum(r['qty'] for r in rows)
    # 编码区间(与生成器同序:按行顺序、行内按台)
    seq = 0
    for r in rows:
        r['from'] = seq + 1
        seq += r['qty']
        r['to'] = seq
        r['type'] = dev_type(r['name'])

    by_type = Counter()
    for r in rows:
        by_type[r['type']] += r['qty']
    by_maker = Counter((r['maker'] or '(未填)') for r in rows for _ in range(r['qty']))

    out = []
    out.append('# 数采设备台账 · 联网设备导入(2026-10-19)')
    out.append('')
    out.append('> 用户口径:「根据这里面的数据，把是否联网是的设备的数据整理出来，加入系统的**测试账套**里面的'
               '数采平台的设备数据里面」')
    out.append('>')
    out.append('> 数据源:`副本副本生产设备列表统计(2026)(1).xls`(工作表「生产设备列表」,'
               f'全表 {all_units} 台)。'
               '落地脚本:`tools/migrate-dc-device-import-20261019.sql`(测试账套 `HSDZ_MES_TEST`)。')
    out.append('')
    out.append('## 一、整理口径')
    out.append('')
    out.append('| 项 | 口径 |')
    out.append('|---|---|')
    out.append('| 取数范围 | 只取「是否联网 = **是**」的行 |')
    out.append(f'| 行数 / 台数 | **{len(rows)} 行 / {units} 台**(全表 {all_units} 台,联网占 {units / all_units:.0%}) |')
    out.append('| 台账粒度 | **一台一条**:数量 17 台的「内绕机」= 17 条设备台账(将来每台各自绑网关/采集点,'
               '数量塞进一条会丢信息) |')
    out.append('| 设备编码 | `LW-001` … `LW-%03d`(LW = 联网,可一眼看出是导入台账) |' % units)
    out.append('| 保留字段 | 原表「序号 / 数量 / 生产厂家 / 是否为数字化设备」全部写进备注,可回溯到原行 |')
    out.append('| 状态 | `offline`、启用、**未绑网关**、无采集点 —— 这是台账登记,不造任何采样值 |')
    out.append('')
    out.append('## 二、按类型 / 厂家汇总')
    out.append('')
    out.append('| 设备类型 | 台数 |')
    out.append('|---|---:|')
    for k, v in by_type.most_common():
        out.append('| %s | %d |' % (k, v))
    out.append('| **合计** | **%d** |' % units)
    out.append('')
    out.append('| 生产厂家 | 台数 |')
    out.append('|---|---:|')
    for k, v in by_maker.most_common():
        out.append('| %s | %d |' % (k, v))
    out.append('')
    out.append('## 三、明细(联网 = 是,共 %d 行)' % len(rows))
    out.append('')
    out.append('| 原表序号 | 设备名称 | 生产厂家 | 数量 | 数字化 | 联网 | 导入设备编码 | 归入类型 |')
    out.append('|---:|---|---|---:|---|---|---|---|')
    for r in rows:
        code = 'LW-%03d' % r['from'] if r['qty'] == 1 else 'LW-%03d ~ LW-%03d' % (r['from'], r['to'])
        out.append('| %s | %s | %s | %d | %s | %s | %s | %s |' % (
            r['no'], r['name'], r['maker'] or '-', r['qty'], r['digital'] or '-', r['networked'], code, r['type']))
    out.append('')
    out.append('## 四、系统里怎么看')
    out.append('')
    out.append('1. 登录时「登录工厂」选 **YINJIA-MES·测试库**(`HSDZ_MES_TEST`);')
    out.append('2. 左侧 **数采平台 → 设备配置管理**:设备总数从 4 台变成 **133 台**(129 台导入 + 4 台原有),'
               '搜索 `LW-` 可只看导入台账;')
    out.append('3. 每台设备点「编辑」可补 IP/端口/车间/数采工程,或绑定网关后由 `/api/dc/ingest` 写真实数据。')
    out.append('')
    out.append('## 五、两个需要人确认的数据问题')
    out.append('')
    out.append('1. 原表 **序号 56「3606前壳盖模铜模」**:「是否为数字化设备 = 否」但「是否联网 = 是」'
               '(自相矛盾)。本次按用户口径(**看「是否联网」**)纳入,备注里写明这条冲突 ——'
               '若判定它不该进数采台账,删这一条即可(编码段见上表)。')
    out.append('2. 原表「设备采购合同编号」列 **全空**,故导入台账未带合同号;'
               '需要的话请在系统里「设备台账 · 备注」补,或把合同号补进原表后重跑生成器。')
    out.append('')
    out.append('## 六、重跑 / 改口径')
    out.append('')
    out.append('```bash')
    out.append('# 改 xls 或归类规则后重跑生成器(脚本按 code 幂等,不覆盖人工改过的台账)')
    out.append('python tools/archive/_dc-device-import-20261019/gen_import.py')
    out.append('python tools/archive/_dc-device-import-20261019/_gen_doc.py')
    out.append('cd tools && YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\\mssql-jdbc.jar DbSync.java')
    out.append('```')
    out.append('')
    out.append('> ⚠ 脚本自带库名闸门:只在 `HSDZ_MES_TEST` 写入,其它库上下文打了个提示就返回'
               '(正式账套不会多出这 129 台)。')
    out.append('')

    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out))
    print('wrote', os.path.abspath(OUT), 'rows', len(rows), 'units', units)


if __name__ == '__main__':
    main()
