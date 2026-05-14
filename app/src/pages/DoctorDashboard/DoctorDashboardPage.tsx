import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { t } from '../../lib/i18n'
import { useStore } from '../../store/useStore'

export function DoctorDashboardPage() {
  const language = useStore((s) => s.language)
  const doctorProfile = useStore((s) => s.doctorProfile)
  const setDoctorClinicName = useStore((s) => s.setDoctorClinicName)
  const generateClinicCode = useStore((s) => s.generateClinicCode)
  const upsertDoctorPatient = useStore((s) => s.upsertDoctorPatient)
  const addDoctorNote = useStore((s) => s.addDoctorNote)

  const [noteText, setNoteText] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')

  const patients = doctorProfile.patients
  const selected = useMemo(() => patients.find((p) => p.id === selectedPatientId) ?? null, [patients, selectedPatientId])

  const onAddDemoPatient = () => {
    const id = `patient_${Math.random().toString(16).slice(2)}`
    upsertDoctorPatient({ id, displayName: 'Демо пациент', currentStreak: Math.floor(Math.random() * 12), lastScanScore: 70 + Math.floor(Math.random() * 25) })
    setSelectedPatientId(id)
  }

  const onSendNote = () => {
    if (!selectedPatientId || !noteText.trim()) return
    addDoctorNote({ patientId: selectedPatientId, noteText: noteText.trim() })
    setNoteText('')
  }

  return (
    <div className="grid gap-3">
      <Card>
        <div className="text-base font-extrabold text-slate-900">{t(language, 'doctor.title')}</div>
        <div className="mt-3 grid gap-3">
          <Input
            label={t(language, 'doctor.clinicName')}
            value={doctorProfile.clinicName}
            onChange={(e) => setDoctorClinicName(e.target.value)}
            placeholder="SmartSmile Clinic"
          />
          <div className="flex items-center justify-between gap-2 rounded-3xl border border-slate-200 bg-white/70 px-3 py-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">{t(language, 'doctor.code')}</div>
              <div className="text-lg font-extrabold text-slate-900">{doctorProfile.clinicCode ?? '—'}</div>
            </div>
            <Button onClick={() => generateClinicCode()}>{t(language, 'doctor.generate')}</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-slate-900">{t(language, 'doctor.patients')}</div>
          <Button variant="secondary" onClick={onAddDemoPatient}>
            Демо пациент
          </Button>
        </div>
        <div className="mt-3 grid gap-2">
          {patients.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPatientId(p.id)}
              className={[
                'flex items-center justify-between rounded-3xl border px-3 py-3 text-left',
                p.id === selectedPatientId
                  ? 'border-emerald-300 bg-emerald-500/10'
                  : 'border-slate-200 bg-white/70 hover:bg-white',
              ].join(' ')}
            >
              <div>
                <div className="text-sm font-extrabold text-slate-900">{p.displayName}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">Стрик: {p.currentStreak}</div>
              </div>
              <div className="text-xs font-semibold text-slate-600">{p.lastScanScore ? `${p.lastScanScore}%` : '—'}</div>
            </button>
          ))}
          {patients.length === 0 ? <div className="text-xs font-semibold text-slate-500">Пациентов пока нет</div> : null}
        </div>
      </Card>

      <Card>
        <div className="text-sm font-extrabold text-slate-900">{t(language, 'doctor.note')}</div>
        <div className="mt-2 text-xs font-semibold text-slate-500">{selected ? selected.displayName : 'Выберите пациента'}</div>
        <div className="mt-3 grid gap-2">
          <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Например: Чистите 2 раза в день и не забывайте про нить." />
          <Button fullWidth onClick={onSendNote} disabled={!selectedPatientId || !noteText.trim()}>
            Отправить
          </Button>
        </div>

        <div className="mt-4 grid gap-2">
          {doctorProfile.notes.slice(0, 6).map((n) => (
            <div key={n.id} className="rounded-3xl border border-slate-200 bg-white/70 p-3">
              <div className="text-xs font-semibold text-slate-500">{new Date(n.createdAt).toLocaleString(language === 'ru' ? 'ru-RU' : 'kk-KZ')}</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{n.noteText}</div>
            </div>
          ))}
          {doctorProfile.notes.length === 0 ? <div className="text-xs font-semibold text-slate-500">Пока нет рекомендаций</div> : null}
        </div>
      </Card>
    </div>
  )
}
