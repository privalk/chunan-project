import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { findTemplate } from '../data/templates'
import { getSettings, listPrintJobs, savePrintJob } from '../utils/storage'
import type { PostcardArtifacts, PrinterStatus, PrintJob, RemotePrintJob } from '../types'
import { updateRemotePrintJob } from '../utils/api'

export const usePrintQueueStore = defineStore('printQueue', () => {
  const jobs = ref<PrintJob[]>([])
  const printers = ref<PrinterStatus[]>([])
  const paused = ref(false)
  const running = ref(false)
  const queuedCount = computed(() => jobs.value.filter((job) => job.status === 'queued').length)
  let processTimer: number | undefined
  let loaded = false

  async function load() {
    if (!loaded) {
      jobs.value = await listPrintJobs()
      loaded = true
    }
    await refreshPrinters()
  }

  async function refreshPrinters() {
    printers.value = window.postcardTerminal ? await window.postcardTerminal.getPrinters().catch(() => []) : []
  }

  async function persist(job: PrintJob) {
    const index = jobs.value.findIndex((item) => item.id === job.id)
    if (index >= 0) jobs.value[index] = job
    else jobs.value.unshift(job)
    await savePrintJob(JSON.parse(JSON.stringify(job)))
    if (job.remoteRegistered !== false) void updateRemotePrintJob(job).catch(() => undefined)
  }

  async function enqueue(artifacts: PostcardArtifacts, copies = 1) {
    const settings = getSettings()
    const preferred = printers.value.find((printer) => printer.deviceName === settings.preferredPrinterDeviceName)
    const systemDefault = printers.value.find((printer) => printer.isDefault)
    const printer = preferred || systemDefault || printers.value[0]
    if (!printer) throw new Error('请先在运维台选择打印机')

    const existing = jobs.value.find((job) => job.draftId === artifacts.draft.id && ['queued', 'processing', 'succeeded'].includes(job.status))
    if (existing) throw new Error('这张明信片已经加入打印队列，请勿重复提交')

    const job: PrintJob = {
      id: `PRINT-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      draftId: artifacts.draft.id,
      templateName: findTemplate(artifacts.draft.templateId).name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'queued',
      copies: Math.min(settings.maxPrintCopies, Math.max(1, copies)),
      attempts: 0,
      printerDeviceName: printer.deviceName,
      printerName: printer.name,
      remoteRegistered: false,
      previewDataUrl: artifacts.thumbnailDataUrl,
    }
    await persist(job)
    return job
  }

  async function registerRemote(jobId: string) {
    let job = jobs.value.find((item) => item.id === jobId)
    if (!job) {
      jobs.value = await listPrintJobs()
      job = jobs.value.find((item) => item.id === jobId)
    }
    if (!job) return
    job.remoteRegistered = true
    await savePrintJob(JSON.parse(JSON.stringify(job)))
    await updateRemotePrintJob(job)
  }

  async function enqueueRemote(remote: RemotePrintJob, dataUrl: string) {
    await load()
    const settings = getSettings()
    const printer = printers.value.find((item) => item.deviceName === settings.preferredPrinterDeviceName)
      || printers.value.find((item) => item.isDefault)
      || printers.value[0]
    if (!printer) throw new Error('请先在运维台选择打印机')
    if (!window.postcardTerminal) return

    const existing = jobs.value.find((item) => item.id === remote.id)
    if (existing) {
      if (['failed', 'paused', 'cancelled'].includes(existing.status)) {
        existing.status = 'queued'
        existing.error = undefined
        existing.copies = remote.copies
        existing.printerDeviceName = printer.deviceName
        existing.printerName = printer.name
        existing.updatedAt = new Date().toISOString()
        existing.remoteRegistered = true
        await persist(existing)
        scheduleProcess()
      } else {
        await updateRemotePrintJob(existing)
      }
      return
    }

    await window.postcardTerminal.cachePostcardImage({
      draftId: remote.postcardId,
      dataUrl,
      createdAt: remote.createdAt,
    })
    const job: PrintJob = {
      id: remote.id,
      draftId: remote.postcardId,
      templateName: remote.templateId || '后台推送',
      createdAt: remote.createdAt,
      updatedAt: new Date().toISOString(),
      status: 'queued',
      copies: remote.copies,
      attempts: 0,
      printerDeviceName: printer.deviceName,
      printerName: printer.name,
      remoteRegistered: true,
      previewDataUrl: dataUrl,
    }
    await persist(job)
    scheduleProcess()
  }

  function scheduleProcess(delay = 0) {
    if (processTimer) window.clearTimeout(processTimer)
    processTimer = window.setTimeout(() => {
      processTimer = undefined
      void process()
    }, delay)
  }

  async function process() {
    if (paused.value || running.value) return
    const next = jobs.value.filter((job) => job.status === 'queued').sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]
    if (!next || !window.postcardTerminal) return

    const settings = getSettings()
    const earliestPrintAt = Number(localStorage.getItem('postcard-last-print-at') || 0) + settings.minPrintIntervalSeconds * 1000
    if (Date.now() < earliestPrintAt) {
      scheduleProcess(earliestPrintAt - Date.now())
      return
    }

    running.value = true
    next.status = 'processing'
    next.attempts += 1
    next.updatedAt = new Date().toISOString()
    await persist(next)
    try {
      const printerName = next.printerDeviceName
        || settings.preferredPrinterDeviceName
        || printers.value.find((printer) => printer.isDefault)?.deviceName
        || printers.value[0]?.deviceName
      if (!printerName) throw new Error('请先在运维台选择打印机')
      localStorage.setItem('postcard-last-print-at', String(Date.now()))
      const response = await window.postcardTerminal.printPostcard({
        jobId: next.id,
        draftId: next.draftId,
        copies: next.copies,
        printerName,
      })
      next.status = response.ok ? 'succeeded' : 'failed'
      next.error = response.error
    } catch (reason) {
      next.status = 'failed'
      next.error = reason instanceof Error ? reason.message : '打印失败'
    } finally {
      next.updatedAt = new Date().toISOString()
      await persist(next)
      running.value = false
      scheduleProcess()
    }
  }

  async function setPaused(value: boolean) {
    paused.value = value
    for (const job of jobs.value.filter((item) => item.status === (value ? 'queued' : 'paused'))) {
      job.status = value ? 'paused' : 'queued'
      job.updatedAt = new Date().toISOString()
      await persist(job)
    }
    if (!value) scheduleProcess()
  }

  async function retry(id: string) {
    const job = jobs.value.find((item) => item.id === id)
    if (!job || job.status !== 'failed') return
    job.status = 'queued'
    job.error = undefined
    job.updatedAt = new Date().toISOString()
    await persist(job)
    scheduleProcess()
  }

  async function cancel(id: string) {
    const job = jobs.value.find((item) => item.id === id)
    if (!job || !['queued', 'paused', 'failed'].includes(job.status)) return
    job.status = 'cancelled'
    job.updatedAt = new Date().toISOString()
    await persist(job)
  }

  return {
    jobs,
    printers,
    paused,
    running,
    queuedCount,
    load,
    refreshPrinters,
    enqueue,
    enqueueRemote,
    registerRemote,
    process,
    setPaused,
    retry,
    cancel,
  }
})
