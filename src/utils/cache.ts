interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class Cache {
  private cache: Map<string, CacheEntry<any>>;
  private readonly ttl: number; // Time to live in milliseconds

  constructor(ttlSeconds: number = 30) {
    this.cache = new Map();
    this.ttl = ttlSeconds * 1000;
  }

  set(key: string, value: any): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  getTTL(key: string): number {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return 0;
    }

    const now = Date.now();
    const elapsed = now - entry.timestamp;
    const remaining = Math.max(0, this.ttl - elapsed);
    
    return Math.floor(remaining / 1000); // Convert to seconds
  }

  clear(): void {
    this.cache.clear();
  }
} 