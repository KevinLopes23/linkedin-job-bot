/** Agendamento da varredura automática enquanto o app está aberto. */
export class Scheduler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private nextRunAt: number | null = null

  constructor(
    private readonly run: () => void,
    private readonly now: () => number = Date.now
  ) {}

  /** (Re)agenda a próxima execução. Devolve o horário dela, ou null se desligado. */
  schedule(enabled: boolean, intervalMinutes: number): string | null {
    this.clear()
    if (!enabled || intervalMinutes <= 0) return null
    const delayMs = intervalMinutes * 60_000
    this.nextRunAt = this.now() + delayMs
    this.timer = setTimeout(() => {
      this.timer = null
      this.nextRunAt = null
      this.run()
    }, delayMs)
    return new Date(this.nextRunAt).toISOString()
  }

  next(): string | null {
    return this.nextRunAt === null ? null : new Date(this.nextRunAt).toISOString()
  }

  clear(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.nextRunAt = null
  }
}
