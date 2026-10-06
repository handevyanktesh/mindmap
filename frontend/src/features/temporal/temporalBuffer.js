/**
 * Temporal Rolling Buffer
 *
 * Maintains a bounded time-series buffer of recent facial feature samples.
 * Uses explicit timestamps for eviction rather than fixed frame counts,
 * ensuring resilience to fluctuating browser frame rates (e.g. 20-60 FPS).
 */

export class TemporalBuffer {
  /**
   * @param {number} windowMs - Rolling window duration in milliseconds (default: 5000ms / 5.0s)
   * @param {number} maxCapacity - Maximum sample count safety ceiling to prevent unbounded growth (default: 600)
   */
  constructor(windowMs = 5000, maxCapacity = 600) {
    this.windowMs = windowMs
    this.maxCapacity = maxCapacity
    this.samples = []
  }

  /**
   * Appends a new timestamped feature sample and evicts expired samples.
   *
   * @param {object} sample - { timestamp: number, ear: number|null, gazeX: number|null, gazeY: number|null, yaw: number|null, pitch: number|null, roll: number|null }
   */
  addSample(sample) {
    if (!sample || typeof sample.timestamp !== 'number' || !Number.isFinite(sample.timestamp)) {
      return
    }

    // Sanitize sample scalar values to finite numbers or null
    const sanitized = {
      timestamp: sample.timestamp,
      ear: Number.isFinite(sample.ear) ? sample.ear : null,
      gazeX: Number.isFinite(sample.gazeX) ? sample.gazeX : null,
      gazeY: Number.isFinite(sample.gazeY) ? sample.gazeY : null,
      yaw: Number.isFinite(sample.yaw) ? sample.yaw : null,
      pitch: Number.isFinite(sample.pitch) ? sample.pitch : null,
      roll: Number.isFinite(sample.roll) ? sample.roll : null
    }

    this.samples.push(sanitized)
    this.evict(sanitized.timestamp)
  }

  /**
   * Removes samples outside the rolling time window.
   *
   * @param {number} currentTimestamp
   */
  evict(currentTimestamp) {
    const cutoff = currentTimestamp - this.windowMs

    // Fast-path: find first index within cutoff
    let firstValidIndex = 0
    while (
      firstValidIndex < this.samples.length &&
      this.samples[firstValidIndex].timestamp < cutoff
    ) {
      firstValidIndex++
    }

    if (firstValidIndex > 0) {
      this.samples.splice(0, firstValidIndex)
    }

    // Safety guard against abnormal capacity
    if (this.samples.length > this.maxCapacity) {
      this.samples.splice(0, this.samples.length - this.maxCapacity)
    }
  }

  /**
   * Returns a copy of current active samples in chronological order.
   *
   * @returns {Array<object>}
   */
  getSamples() {
    return this.samples.slice()
  }

  /**
   * Returns the count of active samples.
   *
   * @returns {number}
   */
  size() {
    return this.samples.length
  }

  /**
   * Returns the time span in milliseconds spanned by current samples in buffer.
   *
   * @returns {number}
   */
  getSpanMs() {
    if (this.samples.length < 2) return 0
    return this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp
  }

  /**
   * Clears all samples in the buffer.
   */
  clear() {
    this.samples = []
  }
}
