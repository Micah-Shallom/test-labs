import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActiveKey, StoredCredentials, RequestLogEntry, VaultEntry, ScopeMeta } from '@/types'

// ── Store shape ───────────────────────────────────────────────────────────────

type BannerKey = 'sessionInvalid' | 'serverUnreachable' | 'apiKeyInvalid'

interface AppStore {
  // ── State ──────────────────────────────────────────────────────────────────
  baseURL:            string
  sessionToken:       string
  orgId:              string
  activeKey:          ActiveKey | null
  storedCredentials:  StoredCredentials | null
  keyVault:           VaultEntry[]
  requestLog:         RequestLogEntry[]
  showRequestLog:     boolean
  activePanel:        string
  panelContext:       Record<string, unknown> | null

  /** Global error banner flags — set by apiRequest, cleared by dismiss or success */
  banners: {
    sessionInvalid:    boolean
    serverUnreachable: boolean
    apiKeyInvalid:     boolean
  }

  /** Briefly true after orgId is auto-populated — used to flash the ConfigBar input */
  orgIdFlash: boolean

  // ── Scopes (fetched from GET /v1/apikeys/scopes, not persisted) ──────────
  scopes:          ScopeMeta[]
  scopeCategories: string[]
  scopesLoading:   boolean
  scopesLoaded:    boolean

  // ── Actions ────────────────────────────────────────────────────────────────
  setBaseURL:           (url: string) => void
  setSessionToken:      (token: string) => void
  setOrgId:             (id: string) => void
  setActiveKey:         (key: ActiveKey | null) => void
  clearActiveKey:       () => void
  setStoredCredentials: (creds: StoredCredentials | null) => void

  /** Add a created key to the vault. Prepends, caps at 50. */
  addToVault:              (entry: VaultEntry) => void
  /** Remove a key from the vault by ID. */
  removeFromVault:         (id: string) => void
  /** Update a vault entry's status (e.g. after revoke/suspend). */
  updateVaultEntryStatus:  (id: string, status: string) => void
  /** Select a vault entry as the active key + stored credentials. */
  selectVaultEntry:        (id: string) => void

  /** Prepend a log entry; cap at 100. */
  pushLogEntry:         (entry: RequestLogEntry) => void
  clearRequestLog:      () => void
  toggleRequestLog:     () => void
  /** Set or clear a specific banner. */
  setBanner:            (key: BannerKey, value: boolean) => void
  /**
   * Navigate to a panel and optionally pass pre-fill context.
   * Calling this from outside React: useAppStore.getState().navigateTo(...)
   */
  navigateTo:           (panelId: string, context?: Record<string, unknown> | null) => void
  /** Sets orgId only if it is currently empty; triggers a 1-second green flash. */
  autoPopulateOrgId:    (orgId: string) => void
  /** Fetch permission scopes from GET /v1/apikeys/scopes (no auth). Caches in memory. */
  fetchScopes:          () => Promise<void>
}

// ── Store implementation ──────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      baseURL:           'http://localhost:3000',
      sessionToken:      '',
      orgId:             '',
      activeKey:         null,
      storedCredentials: null,
      keyVault:          [],
      requestLog:        [],
      showRequestLog:    false,
      activePanel:       'create-key',
      panelContext:      null,
      banners:           { sessionInvalid: false, serverUnreachable: false, apiKeyInvalid: false },
      orgIdFlash:        false,
      scopes:            [],
      scopeCategories:   [],
      scopesLoading:     false,
      scopesLoaded:      false,

      setBaseURL:           (url)   => set({ baseURL: url }),
      setSessionToken:      (token) => set({ sessionToken: token }),
      setOrgId:             (id)    => set({ orgId: id }),
      setActiveKey:         (key)   => set({ activeKey: key }),
      clearActiveKey:       ()      => set({ activeKey: null, storedCredentials: null }),
      setStoredCredentials: (creds) => set({ storedCredentials: creds }),

      addToVault: (entry) =>
        set((state) => ({
          keyVault: [entry, ...state.keyVault.filter(e => e.id !== entry.id)].slice(0, 50),
        })),

      removeFromVault: (id) =>
        set((state) => ({
          keyVault: state.keyVault.filter(e => e.id !== id),
        })),

      updateVaultEntryStatus: (id, status) =>
        set((state) => ({
          keyVault: state.keyVault.map(e => e.id === id ? { ...e, status } : e),
          // Also update activeKey if it matches
          activeKey: state.activeKey?.id === id
            ? { ...state.activeKey, status }
            : state.activeKey,
        })),

      selectVaultEntry: (id) => {
        const entry = get().keyVault.find(e => e.id === id)
        if (!entry) return
        set({
          activeKey: { id: entry.id, prefix: entry.prefix, mode: entry.mode, status: entry.status },
          storedCredentials: { key: entry.key, secret: entry.secret },
        })
      },

      pushLogEntry: (entry) =>
        set((state) => ({
          requestLog: [entry, ...state.requestLog].slice(0, 100),
        })),

      clearRequestLog: () => set({ requestLog: [] }),

      toggleRequestLog: () =>
        set((state) => ({ showRequestLog: !state.showRequestLog })),

      setBanner: (key, value) =>
        set((state) => ({ banners: { ...state.banners, [key]: value } })),

      navigateTo: (panelId, context = null) =>
        set({ activePanel: panelId, panelContext: context ?? null }),

      autoPopulateOrgId: (orgId) => {
        if (!get().orgId) {
          set({ orgId, orgIdFlash: true })
          setTimeout(() => set({ orgIdFlash: false }), 1000)
        }
      },

      fetchScopes: async () => {
        if (get().scopesLoaded || get().scopesLoading) return
        set({ scopesLoading: true })
        try {
          const res = await fetch(get().baseURL + '/v1/apikeys/scopes')
          if (res.ok) {
            const json = await res.json()
            const data = json.data ?? json
            set({
              scopes:          data.scopes ?? [],
              scopeCategories: data.categories ?? [],
              scopesLoaded:    true,
            })
          }
        } catch { /* silently fail — user can retry */ }
        set({ scopesLoading: false })
      },
    }),
    {
      name: 'api-key-tester-store',
      partialize: (state) => ({
        baseURL:           state.baseURL,
        sessionToken:      state.sessionToken,
        orgId:             state.orgId,
        keyVault:          state.keyVault,
        activeKey:         state.activeKey,
        storedCredentials: state.storedCredentials,
      }),
    },
  ),
)
