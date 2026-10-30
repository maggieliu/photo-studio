// Keeps one object URL per photo for as long as the photo exists, so edits
// (rating, tags, ...) never swap the <img> src out from under the browser.
export class ThumbUrlCache {
  private urls = new Map<string, string>()
  private create: (blob: Blob) => string
  private revoke: (url: string) => void

  constructor(
    create: (blob: Blob) => string = (b) => URL.createObjectURL(b),
    revoke: (url: string) => void = (u) => URL.revokeObjectURL(u),
  ) {
    this.create = create
    this.revoke = revoke
  }

  get(id: string, blob: Blob): string {
    let url = this.urls.get(id)
    if (!url) {
      url = this.create(blob)
      this.urls.set(id, url)
    }
    return url
  }

  /**
   * The photo's thumbnail changed: the next get() makes a new URL. The old one
   * is revoked after a delay, because an <img> may still be showing it.
   */
  replace(id: string, revokeAfterMs = 5000) {
    const url = this.urls.get(id)
    if (!url) return
    this.urls.delete(id)
    setTimeout(() => this.revoke(url), revokeAfterMs)
  }

  /** Release URLs for photos that are no longer in the library. */
  prune(keepIds: Iterable<string>) {
    const keep = new Set(keepIds)
    for (const [id, url] of this.urls) {
      if (!keep.has(id)) {
        this.revoke(url)
        this.urls.delete(id)
      }
    }
  }

  clear() {
    this.prune([])
  }
}
