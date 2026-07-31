<script setup lang="ts">
defineProps<{ status: string }>()

const labels: Record<string, string> = {
  active: '在库', archived: '已归档', deleted: '已删除', synced: '已同步', online: '在线', offline: '离线', disabled: '已停用',
  admin: '系统管理员', operator: '业务管理员', auditor: '只读审计',
  pending: '待审核', approved: '已通过', rejected: '已驳回', published: '已上墙', hidden: '已下墙',
  created: '已创建', queued: '排队中', processing: '打印中', succeeded: '已完成', failed: '失败', paused: '已暂停', cancelled: '已取消',
}
</script>

<template>
  <span class="status-badge" :class="`is-${status}`"><i />{{ labels[status] || status }}</span>
</template>

<style scoped>
.status-badge { display: inline-flex; min-height: 26px; padding: 0 9px; align-items: center; gap: 6px; border: 1px solid var(--ca-border); border-radius: 13px; background: var(--ca-surface); color: var(--ca-muted); font-size: 11px; white-space: nowrap; }
.status-badge i { width: 6px; height: 6px; border-radius: 50%; background: var(--ca-quiet); }
.is-active, .is-synced, .is-online { border-color: rgba(106, 136, 115, .28); background: rgba(106, 136, 115, .09); color: #52705b; }
.is-active i, .is-synced i, .is-online i { background: var(--ca-green); box-shadow: 0 0 0 3px rgba(106, 136, 115, .12); }
.is-archived, .is-auditor { background: #efebe3; color: #716a60; }.is-archived i, .is-auditor i { background: #8d8579; }
.is-deleted, .is-offline, .is-disabled { border-color: rgba(159, 41, 37, .18); background: rgba(159, 41, 37, .06); color: var(--ca-red); }.is-deleted i, .is-offline i, .is-disabled i { background: var(--ca-red); }
.is-admin { border-color: rgba(159, 41, 37, .2); background: rgba(159, 41, 37, .07); color: var(--ca-red); }.is-admin i { background: var(--ca-red); }
.is-operator { border-color: rgba(103, 81, 48, .2); background: #f4eee3; color: #806941; }.is-operator i { background: #a4844f; }
.is-approved, .is-published { border-color: rgba(106,136,115,.28); background: rgba(106,136,115,.09); color: #52705b; }.is-approved i, .is-published i { background: var(--ca-green); }
.is-pending, .is-hidden { border-color: rgba(164,132,79,.25); background: #f4eee3; color: #806941; }.is-pending i, .is-hidden i { background: #a4844f; }
.is-rejected { border-color: rgba(159,41,37,.18); background: rgba(159,41,37,.06); color: var(--ca-red); }.is-rejected i { background: var(--ca-red); }
.is-succeeded, .is-processing { border-color: rgba(106,136,115,.28); background: rgba(106,136,115,.09); color: #52705b; }.is-succeeded i, .is-processing i { background: var(--ca-green); }
.is-created, .is-queued, .is-paused { border-color: rgba(164,132,79,.25); background: #f4eee3; color: #806941; }.is-created i, .is-queued i, .is-paused i { background: #a4844f; }
.is-failed, .is-cancelled { border-color: rgba(159,41,37,.18); background: rgba(159,41,37,.06); color: var(--ca-red); }.is-failed i, .is-cancelled i { background: var(--ca-red); }
</style>
