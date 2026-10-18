/**
 * 数采平台接口封装(DC = Data Collection)
 * ---------------------------------------------------------------------------
 * 对应后端 DcController(/api/dc/**),响应统一为 { code: 200, message: 'success', data }:
 *   GET  /dc/config            设备配置页:统计 + 网关列表 + 设备五连检查
 *   POST /dc/gateway/save      新增/修改网关
 *   POST /dc/gateway/delete    删除网关
 *   POST /dc/device/save       新增/修改设备
 *   POST /dc/device/delete     删除设备
 *   POST /dc/device/debug      标记「数据调试」已完成
 *   GET  /dc/points            采集点列表(deviceId 可选) —— 硬件上报的 pointCode 必须先在此登记
 *   POST /dc/point/save        新增/修改采集点
 *   POST /dc/point/delete      删除采集点
 *   GET  /dc/rules             数采规则列表(deviceId 可选)
 *   POST /dc/rule/save         新增/修改数采规则
 *   POST /dc/rule/delete       删除数采规则
 *   GET  /dc/monitor           实时数据监控(deviceId 可选,不传=全部设备)
 *   POST /dc/alarm/handle      处理报警
 *   GET  /dc/stats             状态统计(from/to 为 YYYY-MM-DD)
 * 硬件接入侧(前端不调用,仅在配置页提示):
 *   POST /dc/ingest            { gatewayCode, deviceCode, values:[{ pointCode, value }] }
 *   POST /dc/heartbeat         { deviceCode }
 * 前缀 /api 由 @core/request 的 baseURL 处理。
 */
import request from '@core/request'

function unwrap(res, fallback) {
  if (res && res.code && res.code !== 200) throw new Error(res.message || fallback)
  return res?.data ?? res
}

/** 设备配置页数据:{ kpis, gateways, devices } */
export async function apiGetDcConfig() {
  return unwrap(await request.get('/dc/config'), '加载数采配置失败')
}

/** 新增/修改网关,返回 { id } */
export async function apiSaveDcGateway(payload) {
  return unwrap(await request.post('/dc/gateway/save', payload), '保存网关失败')
}

/** 删除网关 */
export async function apiDeleteDcGateway(id) {
  return unwrap(await request.post('/dc/gateway/delete', { id }), '删除网关失败')
}

/** 新增/修改设备,返回 { id } */
export async function apiSaveDcDevice(payload) {
  return unwrap(await request.post('/dc/device/save', payload), '保存设备失败')
}

/** 删除设备 */
export async function apiDeleteDcDevice(id) {
  return unwrap(await request.post('/dc/device/delete', { id }), '删除设备失败')
}

/** 标记数据调试完成(后端置 debugged 并留痕) */
export async function apiMarkDcDebugged(id) {
  return unwrap(await request.post('/dc/device/debug', { id }), '标记调试失败')
}

/** 采集点列表:{ id, deviceId, code, name, dataType, unit, lowLimit, highLimit, freqSeconds, ... } */
export async function apiGetDcPoints(deviceId) {
  const params = deviceId === undefined || deviceId === null || deviceId === '' ? undefined : { deviceId }
  return unwrap(await request.get('/dc/points', { params }), '加载采集点失败')
}

/** 新增/修改采集点,返回 { id } */
export async function apiSaveDcPoint(payload) {
  return unwrap(await request.post('/dc/point/save', payload), '保存采集点失败')
}

/** 删除采集点 */
export async function apiDeleteDcPoint(id) {
  return unwrap(await request.post('/dc/point/delete', { id }), '删除采集点失败')
}

/** 数采规则列表 */
export async function apiGetDcRules(deviceId) {
  const params = deviceId === undefined || deviceId === null || deviceId === '' ? undefined : { deviceId }
  return unwrap(await request.get('/dc/rules', { params }), '加载数采规则失败')
}

/** 新增/修改数采规则,返回 { id } */
export async function apiSaveDcRule(payload) {
  return unwrap(await request.post('/dc/rule/save', payload), '保存数采规则失败')
}

/** 删除数采规则 */
export async function apiDeleteDcRule(id) {
  return unwrap(await request.post('/dc/rule/delete', { id }), '删除数采规则失败')
}

/** 实时监控:{ devices, points, alarms } */
export async function apiGetDcMonitor(deviceId) {
  const params = deviceId === undefined || deviceId === null || deviceId === '' ? undefined : { deviceId }
  return unwrap(await request.get('/dc/monitor', { params }), '加载监控数据失败')
}

/** 处理报警 */
export async function apiHandleDcAlarm(id, note) {
  return unwrap(await request.post('/dc/alarm/handle', { id, note }), '处理报警失败')
}

/** 状态统计:{ range, summary, byDevice, trend, alarms } */
export async function apiGetDcStats(from, to) {
  return unwrap(await request.get('/dc/stats', { params: { from, to } }), '加载状态统计失败')
}
