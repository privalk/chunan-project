<script setup lang="ts">
defineProps<{
  name: 'arrow' | 'check' | 'clear' | 'clock' | 'close' | 'pen' | 'redo' | 'undo'
}>()
</script>

<template>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path v-if="name === 'arrow'" d="M5 12h14M13 6l6 6-6 6" />
    <path v-else-if="name === 'check'" d="m5 12 4 4L19 6" />
    <path v-else-if="name === 'clear'" d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
    <path v-else-if="name === 'clock'" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2" />
    <path v-else-if="name === 'close'" d="m6 6 12 12M18 6 6 18" />
    <path v-else-if="name === 'pen'" d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm9.5-12.5 3 3M5.5 16l3 3" />
    <path v-else-if="name === 'redo'" d="M20 7v6h-6M19 13a8 8 0 1 0-2 4" />
    <path v-else-if="name === 'undo'" d="M4 7v6h6M5 13a8 8 0 1 1 2 4" />
  </svg>
</template>

<style scoped>
svg { width: 1.35em; height: 1.35em; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
</style>
