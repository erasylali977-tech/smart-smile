import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type Language = 'ru' | 'kz'
export type AccountType = 'parent' | 'adult' | 'doctor'

export type ChildProfile = {
  id: string
  name: string
  age: number
  mascotId: number
  dentCoins: number
  currentStreak: number
}

export type BrushingSession = {
  id: string
  userId: string
  childId?: string
  startedAt: string
  durationSeconds: number
  zonesCompleted: number
  coinsEarned: number
  sessionDate: string
}

export type AiScan = {
  id: string
  userId: string
  photoUrl: string
  cleanlinessScore: number
  plaqueVisible: boolean
  colorAssessment: 'white' | 'yellow' | 'gray'
  recommendations: string[]
  positiveNote: string
  disclaimer: string
  createdAt: string
}

export type DoctorNote = {
  id: string
  patientId: string
  noteText: string
  createdAt: string
}

export type DoctorPatient = {
  id: string
  displayName: string
  currentStreak: number
  lastScanScore?: number
}

export type ShopItem = {
  id: string
  emoji: string
  titleRu: string
  titleKz: string
  subtitleRu: string
  subtitleKz: string
  price: number
  url?: string | null
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'floss',
    emoji: '🧵',
    titleRu: 'Нить (флосс)',
    titleKz: 'Тіс жібі (флосс)',
    subtitleRu: 'Для межзубных промежутков',
    subtitleKz: 'Аралықтарды тазалау үшін',
    price: 40,
    url: null,
  },
  {
    id: 'interdental',
    emoji: '🪥',
    titleRu: 'Ёршики',
    titleKz: 'Ершиктер',
    subtitleRu: 'Особенно полезно с брекетами',
    subtitleKz: 'Брекетпен әсіресе пайдалы',
    price: 55,
    url: null,
  },
  {
    id: 'gum_paste',
    emoji: '🦷',
    titleRu: 'Паста для дёсен',
    titleKz: 'Қызыл иекке паста',
    subtitleRu: 'Если есть кровоточивость',
    subtitleKz: 'Қан кетсе',
    price: 70,
    url: 'https://www.parodontax.com/',
  },
  {
    id: 'sensitive_paste',
    emoji: '🧊',
    titleRu: 'Паста от чувствительности',
    titleKz: 'Сезімталдыққа паста',
    subtitleRu: 'При чувствительности зубов',
    subtitleKz: 'Сезімталдық болса',
    price: 70,
    url: null,
  },
  {
    id: 'soft_brush',
    emoji: '🪥',
    titleRu: 'Мягкая щётка',
    titleKz: 'Жұмсақ тіс щеткасы',
    subtitleRu: 'Деликатная чистка',
    subtitleKz: 'Жұмсақ тазалау',
    price: 60,
    url: null,
  },
  {
    id: 'mouthwash',
    emoji: '🫧',
    titleRu: 'Ополаскиватель',
    titleKz: 'Шайғыш',
    subtitleRu: 'После чистки / нити',
    subtitleKz: 'Тазалаудан кейін',
    price: 45,
    url: null,
  },
]

type StoreState = {
  userId: string
  isAuthed: boolean
  onboardingCompleted: boolean
  language: Language

  accountType: AccountType | null
  displayName: string
  age: number | null
  mascotId: number | null
  goal: 'improve' | 'track_child' | 'work_patients' | null

  childProfiles: ChildProfile[]

  dentCoins: number
  brushingSessions: BrushingSession[]
  aiScans: AiScan[]

  ownedShopItems: Record<string, number>

  linkedClinicCode: string | null

  doctorProfile: {
    clinicName: string
    clinicCode: string | null
    patients: DoctorPatient[]
    notes: DoctorNote[]
  }

  setLanguage: (language: Language) => void
  completeOnboarding: (input: {
    accountType: AccountType
    displayName: string
    age?: number | null
    mascotId: number
    goal: StoreState['goal']
    child?: { name: string; age: number; mascotId: number } | null
  }) => void
  signOut: () => void

  addCoins: (delta: number) => void
  addBrushingSession: (session: Omit<BrushingSession, 'id' | 'userId'>) => void
  addAiScan: (scan: Omit<AiScan, 'id' | 'userId'>) => void
  buyShopItem: (itemId: string) => boolean

  linkClinic: (clinicCode: string) => void

  setDoctorClinicName: (clinicName: string) => void
  generateClinicCode: () => void
  upsertDoctorPatient: (patient: DoctorPatient) => void
  addDoctorNote: (note: Omit<DoctorNote, 'id' | 'createdAt'>) => void

  applyDemoProfile: () => void
  resetAllData: () => void
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function generateClinicCode6() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      userId: randomId('user'),
      isAuthed: true,
      onboardingCompleted: false,
      language: 'ru',

      accountType: null,
      displayName: '',
      age: null,
      mascotId: null,
      goal: null,

      childProfiles: [],

      dentCoins: 0,
      brushingSessions: [],
      aiScans: [],

      ownedShopItems: {},

      linkedClinicCode: null,

      doctorProfile: {
        clinicName: '',
        clinicCode: null,
        patients: [],
        notes: [],
      },

      setLanguage: (language) => set({ language }),

      completeOnboarding: (input) => {
        const next: Partial<StoreState> = {
          onboardingCompleted: true,
          isAuthed: true,
          accountType: input.accountType,
          displayName: input.displayName,
          age: input.age ?? null,
          mascotId: input.mascotId,
          goal: input.goal,
        }

        if (input.accountType === 'parent' && input.child) {
          const child: ChildProfile = {
            id: randomId('child'),
            name: input.child.name,
            age: input.child.age,
            mascotId: input.child.mascotId,
            dentCoins: 0,
            currentStreak: 0,
          }
          next.childProfiles = [child]
        }

        set(next as StoreState)
      },

      signOut: () =>
        set({
          isAuthed: false,
          onboardingCompleted: false,
          accountType: null,
          displayName: '',
          age: null,
          mascotId: null,
          goal: null,
          childProfiles: [],
          dentCoins: 0,
          brushingSessions: [],
          aiScans: [],
          linkedClinicCode: null,
          doctorProfile: { clinicName: '', clinicCode: null, patients: [], notes: [] },
        }),

      addCoins: (delta) => set({ dentCoins: Math.max(0, get().dentCoins + delta) }),

      addBrushingSession: (session) => {
        const created: BrushingSession = {
          id: randomId('brush'),
          userId: get().userId,
          ...session,
        }
        set({ brushingSessions: [created, ...get().brushingSessions] })
      },

      addAiScan: (scan) => {
        const created: AiScan = { id: randomId('scan'), userId: get().userId, ...scan }
        set({ aiScans: [created, ...get().aiScans] })
      },

      buyShopItem: (itemId) => {
        const item = SHOP_ITEMS.find((x) => x.id === itemId)
        if (!item) return false
        const coins = get().dentCoins
        if (coins < item.price) return false

        const owned = { ...get().ownedShopItems }
        owned[itemId] = (owned[itemId] ?? 0) + 1
        set({ dentCoins: coins - item.price, ownedShopItems: owned })
        return true
      },

      linkClinic: (clinicCode) => set({ linkedClinicCode: clinicCode.trim().toUpperCase() }),

      setDoctorClinicName: (clinicName) =>
        set({ doctorProfile: { ...get().doctorProfile, clinicName } }),

      generateClinicCode: () =>
        set({
          doctorProfile: {
            ...get().doctorProfile,
            clinicCode: generateClinicCode6(),
          },
        }),

      upsertDoctorPatient: (patient) => {
        const existing = get().doctorProfile.patients
        const idx = existing.findIndex((p) => p.id === patient.id)
        const nextPatients =
          idx === -1
            ? [patient, ...existing]
            : existing.map((p, i) => (i === idx ? { ...p, ...patient } : p))

        set({ doctorProfile: { ...get().doctorProfile, patients: nextPatients } })
      },

      addDoctorNote: (note) => {
        const created: DoctorNote = {
          id: randomId('note'),
          createdAt: new Date().toISOString(),
          ...note,
        }
        set({ doctorProfile: { ...get().doctorProfile, notes: [created, ...get().doctorProfile.notes] } })
      },

      applyDemoProfile: () => {
        const now = new Date()
        const today = toISODate(now)
        const yesterday = toISODate(new Date(now.getTime() - 24 * 60 * 60 * 1000))
        const childId = randomId('child')
        const sessions: BrushingSession[] = [
          {
            id: randomId('brush'),
            userId: get().userId,
            childId,
            startedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
            durationSeconds: 120,
            zonesCompleted: 4,
            coinsEarned: 50,
            sessionDate: today,
          },
          {
            id: randomId('brush'),
            userId: get().userId,
            childId,
            startedAt: new Date(now.getTime() - 28 * 60 * 60 * 1000).toISOString(),
            durationSeconds: 120,
            zonesCompleted: 4,
            coinsEarned: 50,
            sessionDate: yesterday,
          },
        ]
        const scan: AiScan = {
          id: randomId('scan'),
          userId: get().userId,
          photoUrl: '',
          cleanlinessScore: 76,
          plaqueVisible: true,
          colorAssessment: 'yellow',
          recommendations: [
            'Чистите 2 минуты: 4 зоны по 30 секунд.',
            'Добавьте нить/ёршики для межзубных промежутков.',
            'Сделайте повторный AI-скан через 7 дней и сравните прогресс.',
          ],
          positiveNote: 'Отличный старт — уже видно внимание к гигиене.',
          disclaimer: 'Это не медицинский диагноз. Рекомендации основаны только на фото.',
          createdAt: now.toISOString(),
        }

        set({
          onboardingCompleted: true,
          isAuthed: true,
          accountType: 'parent',
          displayName: 'Арайлым',
          age: null,
          mascotId: 1,
          goal: 'track_child',
          childProfiles: [{ id: childId, name: 'Арайлым', age: 7, mascotId: 1, dentCoins: 0, currentStreak: 2 }],
          dentCoins: 160,
          brushingSessions: sessions,
          aiScans: [scan, ...get().aiScans],
          ownedShopItems: { floss: 1 },
        })
      },

      resetAllData: () => {
        const userId = get().userId
        set({
          userId,
          isAuthed: true,
          onboardingCompleted: false,
          language: 'ru',
          accountType: null,
          displayName: '',
          age: null,
          mascotId: null,
          goal: null,
          childProfiles: [],
          dentCoins: 0,
          brushingSessions: [],
          aiScans: [],
          ownedShopItems: {},
          linkedClinicCode: null,
          doctorProfile: { clinicName: '', clinicCode: null, patients: [], notes: [] },
        })
      },
    }),
    {
      name: 'smartsmile_mvp_v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        userId: state.userId,
        isAuthed: state.isAuthed,
        onboardingCompleted: state.onboardingCompleted,
        language: state.language,
        accountType: state.accountType,
        displayName: state.displayName,
        age: state.age,
        mascotId: state.mascotId,
        goal: state.goal,
        childProfiles: state.childProfiles,
        dentCoins: state.dentCoins,
        brushingSessions: state.brushingSessions,
        aiScans: state.aiScans,
        ownedShopItems: state.ownedShopItems,
        linkedClinicCode: state.linkedClinicCode,
        doctorProfile: state.doctorProfile,
      }),
    },
  ),
)
