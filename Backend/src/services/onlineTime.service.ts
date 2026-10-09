const ONLINE_TIME_URL =
  process.env.ONLINE_TIME_API_URL ||
  "https://timeapi.io/api/time/current/zone?timeZone=UTC";

const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const KABUL_TIME_ZONE = "Asia/Kabul";

type TimeSource = "timeapi.io" | "http-date" | "cached-online" | "server-fallback";

interface TimeState {
  offsetMs: number;
  syncedAt: number;
  source: TimeSource;
  online: boolean;
}

export class OnlineTimeService {
  private static state: TimeState = {
    offsetMs: 0,
    syncedAt: 0,
    source: "server-fallback",
    online: false,
  };

  private static syncing: Promise<void> | null = null;

  private static async fetchJsonTime(): Promise<{ epochMs: number; source: TimeSource }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(ONLINE_TIME_URL, {
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`online_time_http_${response.status}`);
      const data: any = await response.json();
      const required = ["year", "month", "day", "hour", "minute", "seconds"];
      if (!required.every(key => Number.isFinite(Number(data[key])))) {
        throw new Error("online_time_invalid_payload");
      }
      const epochMs = Date.UTC(
        Number(data.year),
        Number(data.month) - 1,
        Number(data.day),
        Number(data.hour),
        Number(data.minute),
        Number(data.seconds),
        Number(data.milliSeconds || 0),
      );
      return { epochMs, source: "timeapi.io" };
    } finally {
      clearTimeout(timeout);
    }
  }

  private static async fetchHttpDate(): Promise<{ epochMs: number; source: TimeSource }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("https://www.google.com/generate_204", {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      const dateHeader = response.headers.get("date");
      const epochMs = dateHeader ? Date.parse(dateHeader) : NaN;
      if (!Number.isFinite(epochMs)) throw new Error("online_http_date_missing");
      return { epochMs, source: "http-date" };
    } finally {
      clearTimeout(timeout);
    }
  }

  static async sync(force = false): Promise<void> {
    const age = Date.now() - this.state.syncedAt;
    if (!force && this.state.online && age < SYNC_INTERVAL_MS) return;
    if (this.syncing) return this.syncing;

    this.syncing = (async () => {
      const startedAt = Date.now();
      try {
        let result: { epochMs: number; source: TimeSource };
        try {
          // HTTP Date is generated for every response and is not affected by the
          // 10-15 minute CDN cache observed on the JSON time endpoint.
          result = await this.fetchHttpDate();
        } catch {
          result = await this.fetchJsonTime();
        }
        const completedAt = Date.now();
        const requestMidpoint = startedAt + Math.round((completedAt - startedAt) / 2);
        this.state = {
          offsetMs: result.epochMs - requestMidpoint,
          syncedAt: completedAt,
          source: result.source,
          online: true,
        };
      } catch {
        if (this.state.syncedAt > 0) {
          this.state = { ...this.state, source: "cached-online", online: false };
        } else {
          this.state = {
            offsetMs: 0,
            syncedAt: Date.now(),
            source: "server-fallback",
            online: false,
          };
        }
      }
    })().finally(() => {
      this.syncing = null;
    });

    return this.syncing;
  }

  static start() {
    this.sync(true).catch(() => {});
    const timer = setInterval(() => this.sync(true).catch(() => {}), SYNC_INTERVAL_MS);
    timer.unref();
  }

  static async getTimeInfo() {
    const now = await this.getTrustedNow();
    const dateOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: KABUL_TIME_ZONE,
    };
    return {
      isoDate: now.toISOString(),
      shamsiDate: new Intl.DateTimeFormat("ps-AF-u-ca-persian", dateOptions).format(now),
      qamariDate: new Intl.DateTimeFormat("ps-AF-u-ca-islamic-umalqura", dateOptions).format(now),
      gregorianDate: new Intl.DateTimeFormat("ps-AF-u-ca-gregory", dateOptions).format(now),
      serverTime: now.getTime(),
      timeZone: KABUL_TIME_ZONE,
      source: this.state.source,
      onlineSynced: this.state.online || this.state.source === "cached-online",
      syncedAt: this.state.syncedAt
        ? new Date(this.state.syncedAt + this.state.offsetMs).toISOString()
        : null,
    };
  }

  static async getTrustedNow(): Promise<Date> {
    await this.sync();
    return new Date(Date.now() + this.state.offsetMs);
  }
}
