const SCAN_FILL_ACTION = '扫描填单'

function actionsOf(group) {
  if (Array.isArray(group?.actions)) return group.actions
  if (Array.isArray(group?.items)) return group.items
  return []
}

function enabledFlag(value) {
  return value === true || value === 1 || String(value ?? '').trim().toLowerCase() === 'true'
}

export function supportsScanFill(metadata) {
  return String(metadata?.panelCategory ?? '').trim().endsWith('单据')
    && !enabledFlag(metadata?.readonly)
    && !enabledFlag(metadata?.readOnly)
}

/** Keep old toolbar configurations compatible without mutating their arrays. */
export function ensureScanFillAction(rawGroups, metadata) {
  const groups = (Array.isArray(rawGroups) ? rawGroups : [])
    .filter((group) => group && typeof group === 'object')
    .map((group) => ({
      ...group,
      actions: [...new Set(actionsOf(group))],
    }))

  const categoryKnown = metadata
    && typeof metadata === 'object'
    && Object.prototype.hasOwnProperty.call(metadata, 'panelCategory')
  if (!categoryKnown) return groups

  for (const group of groups) {
    group.actions = group.actions.filter((action) => action !== SCAN_FILL_ACTION)
  }
  if (!supportsScanFill(metadata)) return groups

  const moreGroup = groups.find((group) => group.name === '更多')
  if (moreGroup) {
    if (!moreGroup.actions.length) moreGroup.actions.push('刷新')
    moreGroup.actions.push(SCAN_FILL_ACTION)
  } else {
    groups.push({ name: '更多', actions: ['刷新', SCAN_FILL_ACTION] })
  }
  return groups
}
