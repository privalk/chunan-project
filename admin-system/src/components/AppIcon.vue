<script setup lang="ts">
const paths: Record<string, string[]> = {
  dashboard: ['M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z'],
  signature: ['M4 19c3-1 5-3 7-6l5-7a2.1 2.1 0 0 1 3 3l-7 5c-3 2-5 4-6 7l-2-2Z', 'M14 8l3 3'],
  review: ['M4 5h16v14H4V5Z', 'M8 9h8', 'm8 14 2 2 4-5'],
  terminal: ['M4 5h16v11H4V5Z', 'M9 20h6', 'M12 16v4'],
  audit: ['M6 3h12v18H6V3Z', 'M9 8h6', 'M9 12h6', 'M9 16h4'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-3v-.09a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 6.95 15a1.7 1.7 0 0 0-1.55-1.03H5v-3h.09a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.55V4h3v.09a1.7 1.7 0 0 0 1.1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03H21v3h-.09A1.7 1.7 0 0 0 19.4 15Z'],
  logout: ['M10 17l5-5-5-5', 'M15 12H3', 'M15 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'm21 21-4.35-4.35'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
  archive: ['M4 7h16v13H4V7Z', 'M3 3h18v4H3V3Z', 'M9 11h6'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'm7 0 1 14h10l1-14', 'M10 11v5', 'M14 11v5'],
  refresh: ['M20 7v6h-6', 'M19 13a8 8 0 1 0-2 4'],
  chevron: ['m9 18 6-6-6-6'],
  close: ['m6 6 12 12', 'M18 6 6 18'],
  check: ['m5 12 4 4L19 6'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  edit: ['M4 20h4l11-11a2.1 2.1 0 0 0-3-3L5 17l-1 3Z', 'm14-13 3 3'],
  plus: ['M12 5v14', 'M5 12h14'],
  calendar: ['M4 5h16v16H4V5Z', 'M8 3v4', 'M16 3v4', 'M4 10h16'],
  warning: ['M12 3 2 21h20L12 3Z', 'M12 9v5', 'M12 18h.01'],
  postcard: ['M3 5h18v14H3V5Z', 'M13 5v14', 'M16 9h3', 'M16 12h3'],
  print: ['M6 9V4h12v5', 'M6 18H4v-7h16v7h-2', 'M7 15h10v5H7v-5Z'],
  pause: ['M9 5v14', 'M15 5v14'],
  play: ['m8 5 11 7-11 7V5Z'],
}

const props = defineProps<{ name: keyof typeof paths }>()
</script>

<template>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path v-for="item in paths[props.name]" :key="item" :d="item" />
  </svg>
</template>

<style scoped>
svg { width: 1.25em; height: 1.25em; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
</style>
