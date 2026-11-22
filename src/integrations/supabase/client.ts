import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sivvjwffekhfabgxhbcd.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdnZqd2ZmZWtoZmFiZ3hoYmNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzIyNjIsImV4cCI6MjA5Nzk0ODI2Mn0.fE-yAXe9WYsg2O9o1tqcCbxVMp8bsCGUd2xC0Y8ccNc'

const AUTH_FETCH_TIMEOUT_MS = 12_000
const NAVIGATOR_LOCK_CAP_MS = 4_000

const inTabLocks = new Map<string, Promise<unknown>>()

function runInTabLock<R>(name: string, fn: () => Promise<R>): Promise<R> {
  const previous = inTabLocks.get(name) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(() => fn())
  const tracked = next.finally(() => {
    if (inTabLocks.get(name) === tracked) {
      inTabLocks.delete(name)
    }
  })
  inTabLocks.set(name, tracked)
  return next
}

function createLockTimeoutError(name: string) {
  const err = new Error(`Lock "${name}" acquire timed out`) as Error & { isAcquireTimeout?: boolean }
  err.isAcquireTimeout = true
  return err
}

/**
 * Resilient lock for Supabase Auth: coordinates across tabs via Navigator Locks
 * when healthy, but caps wait time at 4s and falls back to an in-tab queue so a
 * background/frozen mobile Chrome tab can never deadlock login, session restore,
 * or sign-out.
 */
async function resilientAuthLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) {
    return runInTabLock(name, fn)
  }

  if (acquireTimeout === 0) {
    return locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock) throw createLockTimeoutError(name)
      return await fn()
    })
  }

  const effectiveTimeout =
    acquireTimeout > 0 ? Math.min(acquireTimeout, NAVIGATOR_LOCK_CAP_MS) : NAVIGATOR_LOCK_CAP_MS
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), effectiveTimeout)

  try {
    return await locks.request(
      name,
      { mode: 'exclusive', signal: controller.signal },
      async () => {
        globalThis.clearTimeout(timer)
        return await fn()
      }
    )
  } catch (error) {
    globalThis.clearTimeout(timer)
    const isAbort =
      error instanceof DOMException
        ? error.name === 'AbortError'
        : (error as { name?: string })?.name === 'AbortError'
    if (isAbort) {
      // Another frozen tab held the cross-tab lock past the cap; proceed safely in-tab.
      return runInTabLock(name, fn)
    }
    throw error
  }
}

/**
 * Ensures Supabase /auth/v1/ requests never hang indefinitely on flaky mobile
 * sockets (which would otherwise hold the auth lock and freeze sign-in/out).
 */
const boundedSupabaseFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const isAuthRequest = url.includes('/auth/v1/')
  if (!isAuthRequest || typeof AbortController === 'undefined') {
    return fetch(input, init)
  }

  const controller = new AbortController()
  const upstreamSignal = init?.signal
  const onUpstreamAbort = () => controller.abort()
  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort()
    } else {
      upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true })
    }
  }

  const timer = globalThis.setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    globalThis.clearTimeout(timer)
    upstreamSignal?.removeEventListener('abort', onUpstreamAbort)
  })
}

export function hasStoredSupabaseSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && /^sb-.*-auth-token$/.test(key) && window.localStorage.getItem(key)) {
        return true
      }
    }
  } catch {
    // Ignore storage access errors in restricted browsing contexts.
  }
  return false
}

export function clearLocalSupabaseSession(): void {
  if (typeof window === 'undefined') return
  const clearStorage = (storage: Storage) => {
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key && (/^sb-.*-auth-token/.test(key) || key === 'supabase.auth.token' || key === 'currentUser')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => storage.removeItem(key))
    } catch {
      // Ignore storage access errors in restricted browsing contexts.
    }
  }
  clearStorage(window.localStorage)
  clearStorage(window.sessionStorage)
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: resilientAuthLock,
  },
  global: {
    fetch: boundedSupabaseFetch,
  },
})