/**
 * 文件类文书面板配置(数据驱动:DocSheet 按配置渲染版式)
 * row 类型:
 *  - field: { num, label, key, max, h, kind:'input'|'textarea', hint? }   单字段行
 *  - multi: { num, label, h, subs:[{ label, key, max }] }                  多子区行(如 测试方案)
 * signCells: 底部签名区 [ { label, key, w(蓝格宽), type:'text'|'date', flex(占比), white(白底蓝字) } ]
 */
export const approvalSheetCfg = {
  titlePart1: '立项申请表',
  titlePart2: '二三级项目',
  titlePart3: '',
  seq: 'cn',
  deco: true,
  rows: [
    { num: '一', label: '客户名', key: '客户名', max: 0, h: 47, kind: 'input' },
    { num: '二', label: '立项背景', key: '立项背景', max: 250, h: 96, kind: 'textarea' },
    { num: '三', label: '机型及应用位置', key: '机型及应用位置', max: 50, h: 58, kind: 'textarea' },
    { num: '四', label: '滤芯/炭棒规格或结构', key: '滤芯/炭棒规格或结构', max: 100, h: 71, kind: 'textarea' },
    { num: '五', label: '项目开发目标', key: '项目开发目标', max: 250, h: 155, kind: 'textarea' },
    { num: '六', label: '项目输出', key: '项目输出', max: 100, h: 97, kind: 'textarea' },
    { num: '七', label: '开发周期要求', key: '开发周期要求', max: 50, h: 45, kind: 'textarea' },
    { num: '八', label: '其它要求', key: '其它要求', max: 250, h: 132, kind: 'textarea' },
  ],
  signCells: [
    { label: '申请立项人', key: '申请立项人', w: 202, type: 'text', flex: 53 },
    { label: '申请立项日期', key: '申请立项日期', w: 150, type: 'date', flex: 47, white: true },
  ],
}

/** 项目实施计划(二三级项目):原图无右侧虚列;测试方案行为三子区(条件/方法/标准);底部 负责人+编制日期 */
export const planSheetCfg = {
  titlePart1: '项目',
  titlePart2: '二三级项目',
  titlePart3: '实施计划',
  seq: 'num',
  deco: false,
  rows: [
    { num: '1', label: '项目名称', key: '项目名称', max: 50, h: 71, kind: 'input' },
    { num: '2', label: '项目定级', key: '项目定级', max: 30, h: 53, kind: 'input' },
    { num: '3', label: '测试内容', key: '测试内容', max: 100, h: 77, kind: 'textarea' },
    { num: '4', label: '测试产品打样要求', key: '测试产品打样要求', max: 100, h: 103, kind: 'textarea' },
    { num: '5', label: '测试目标', key: '测试目标', max: 50, h: 78, kind: 'textarea' },
    {
      num: '6', label: '测试方案', h: 225,
      subs: [
        { label: '测试条件', key: '测试条件', max: 150 },
        { label: '测试方法', key: '测试方法', max: 150 },
        { label: '测试标准', key: '测试标准', max: 150 },
      ],
    },
    { num: '7', label: '测试计划', key: '测试计划', max: 0, h: 96, kind: 'textarea', hint: '预设10个阶段' },
  ],
  signCells: [
    { label: '负责人', key: '负责人', w: 208, type: 'text', flex: 58 },
    { label: '编制日期', key: '编制日期', w: 180, type: 'date', flex: 42 },
  ],
}
