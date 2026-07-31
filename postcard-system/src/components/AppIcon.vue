<script setup lang="ts">
const props = defineProps<{ name: string; size?: number }>()
const paths: Record<string, string[]> = {
  arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
  back: ['M19 12H5', 'm11 18-6-6 6-6'],
  search: ['m21 21-4.35-4.35', 'M10.7 3.2a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15'],
  camera: ['M4 7h3l2-3h6l2 3h3v13H4V7Z', 'M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
  upload: ['M12 16V4', 'm7 9 5-5 5 5', 'M5 20h14'],
  signature: ['M4 18c4-7 7-11 9-10 2 1-4 8-1 9 2 1 3-4 5-3 1 1 0 3 3 1'],
  template: ['M4 4h16v16H4V4Z', 'M4 10h16', 'M10 10v10'],
  image: ['M4 5h16v14H4V5Z', 'm4 15 5-5 4 4 3-3 4 4', 'M9 10h.01'],
  print: ['M6 9V4h12v5', 'M6 18H4v-7h16v7h-2', 'M7 15h10v5H7v-5Z'],
  download: ['M12 4v11', 'm7 10 5 5 5-5', 'M5 20h14'],
  check: ['m5 12 4 4L19 6'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  compare: ['M5 4h6v16H5V4Z', 'M13 4h6v16h-6V4Z'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M4 12H2m20 0h-2M12 4V2m0 20v-2m5.66-13.66 1.42-1.42M4.92 19.08l1.42-1.42m0-11.32L4.92 4.92m14.16 14.16-1.42-1.42'],
  pause: ['M9 5v14', 'M15 5v14'],
  play: ['m8 5 11 7-11 7V5Z'],
  refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M6.1 8a7 7 0 0 1 11.3-1L20 12M4 12l2.6 5a7 7 0 0 0 11.3-1'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M7 7l1 13h8l1-13'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'],
  qr: ['M4 4h6v6H4V4Z', 'M14 4h6v6h-6V4Z', 'M4 14h6v6H4v-6Z', 'M14 14h2v2h-2v-2Z', 'M18 14h2v6h-4v-2', 'M14 18h2v2h-2'],
}
</script>

<template>
  <svg :width="props.size || 24" :height="props.size || 24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="path in paths[props.name] || paths.template" :key="path" :d="path" />
  </svg>
</template>
