export class VersionTracker {
  private seen = new Set<string>()
  private order: string[] = []
  private versions = new Map<string, number>()

  constructor(private capacity = 500) {}

  accept(e: { eventId: string; resource: { type: string; id: string }; version: number }) {
    if (this.seen.has(e.eventId)) return false
    this.remember(e.eventId)
    const key = `${e.resource.type}:${e.resource.id}`
    const known = this.versions.get(key) ?? 0
    if (e.version <= known) return false
    this.versions.set(key, e.version)
    return true
  }

  observe(type: string, id: string, version: number) {
    const key = `${type}:${id}`
    if (version > (this.versions.get(key) ?? 0)) this.versions.set(key, version)
  }

  private remember(id: string) {
    this.seen.add(id)
    this.order.push(id)
    if (this.order.length > this.capacity) this.seen.delete(this.order.shift()!)
  }
}
