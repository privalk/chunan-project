import type { PostcardTemplate } from '../types'

export const postcardTemplates: PostcardTemplate[] = [
  { id: 't-1950', group: '校史年代', name: '湖畔初声', year: '1956', title: '弦歌初起', subtitle: '一纸寄湖山 · 一念念三中', background: '#e8ddc8', ink: '#3f3a31', accent: '#8c3028', muted: '#8b7a63', motif: 'stamp', enabled: true, order: 1 },
  { id: 't-1960', group: '校史年代', name: '墨绿年华', year: '1966', title: '青葱岁月', subtitle: '那年教室 · 窗外有风', background: '#d9dfd1', ink: '#29362e', accent: '#6d2d28', muted: '#708073', motif: 'window', enabled: true, order: 2 },
  { id: 't-1970', group: '校史年代', name: '山乡课堂', year: '1976', title: '山水同窗', subtitle: '书声越过千岛湖的晨雾', background: '#e5d7bd', ink: '#44382c', accent: '#8d3d2e', muted: '#8c745d', motif: 'mountain', enabled: true, order: 3 },
  { id: 't-1980', group: '校史年代', name: '红砖记忆', year: '1986', title: '青春留影', subtitle: '旧操场 · 红砖墙 · 白衬衫', background: '#ead9c8', ink: '#3f342e', accent: '#9f2925', muted: '#987b68', motif: 'grid', enabled: true, order: 4 },
  { id: 't-1990', group: '校史年代', name: '千岛来信', year: '1996', title: '写给同桌', subtitle: '愿多年以后仍记得这页光阴', background: '#dce2dc', ink: '#2f3a34', accent: '#8a342d', muted: '#748379', motif: 'rings', enabled: true, order: 5 },
  { id: 't-2000', group: '校史年代', name: '新世纪', year: '2006', title: '向新而行', subtitle: '每一次出发都从这里开始', background: '#e8e4d9', ink: '#31342f', accent: '#9f2925', muted: '#7d8076', motif: 'window', enabled: true, order: 6 },
  { id: 't-2010', group: '校史年代', name: '湖光少年', year: '2016', title: '逐光而上', subtitle: '我们在湖光里长成自己的模样', background: '#dce7e3', ink: '#263833', accent: '#9a332c', muted: '#6a827a', motif: 'mountain', enabled: true, order: 7 },
  { id: 't-2020', group: '校史年代', name: '今日三中', year: '2026', title: '此刻正青春', subtitle: '让今天成为明日珍藏', background: '#f0e8db', ink: '#30312d', accent: '#9f2925', muted: '#84786b', motif: 'grid', enabled: true, order: 8 },
  { id: 't-campus', group: '校园印象', name: '校园四季', year: 'CAMPUS', title: '风景正好', subtitle: '从春樱到冬雪 · 四季皆是来信', background: '#e2e8db', ink: '#2f3d32', accent: '#8f302b', muted: '#718071', motif: 'rings', enabled: true, order: 9 },
  { id: 't-anniversary', group: '节庆纪念', name: '校庆纪念', year: 'ANNIVERSARY', title: '归来仍少年', subtitle: '淳安第三中学 · 欢迎回家', background: '#efe2cf', ink: '#43362d', accent: '#9f2925', muted: '#937864', motif: 'stamp', enabled: true, order: 10 },
]

export function findTemplate(id: string) {
  return postcardTemplates.find((item) => item.id === id) || postcardTemplates[0]
}
