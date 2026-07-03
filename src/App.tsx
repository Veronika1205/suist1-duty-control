import { useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowRightLeft, Bell, Check, CheckCircle2, ChevronRight,
  ClipboardCheck, Clock3, FileSearch, History, MessageSquare, RefreshCw, Search,
  Send, ShieldCheck, UserRound, UsersRound, X,
} from 'lucide-react'

type Status = 'На сегодня' | 'Просрочен' | 'В работе'
type Order = {
  id: string
  description: string
  executor: string
  group: string
  dueDate: string
  status: Status
  comment: string
  priority: 'Критический' | 'Высокий' | 'Средний'
}
type Log = { id: number; time: string; order: string; executor: string; action: string; comment: string }

const isoToday = (date = new Date()) => {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10)
}
const shiftDate = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return isoToday(date)
}
const fmtDate = (date: Date) => date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
const fmtShort = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU')
const fmtTime = (date: Date) => date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const initialOrders: Order[] = [
  { id: 'НР-2407-0182', description: 'Диагностика потери телеметрии на узле связи КС-14', executor: 'Касымов А. Р.', group: 'Сменная бригада №2', dueDate: isoToday(), status: 'На сегодня', comment: 'Ожидается подтверждение доступа', priority: 'Критический' },
  { id: 'НР-2407-0186', description: 'Проверка резервного канала передачи данных на ПС-7', executor: 'Иванова М. С.', group: 'АСУ ТП', dueDate: isoToday(), status: 'На сегодня', comment: 'Работы согласованы', priority: 'Высокий' },
  { id: 'НР-2407-0191', description: 'Замена модуля питания контроллера шкафа ШТМ-03', executor: 'Сериков Д. Н.', group: 'Электротехническая', dueDate: isoToday(), status: 'На сегодня', comment: 'ЗИП получен со склада', priority: 'Средний' },
  { id: 'НР-2407-0194', description: 'Восстановление связи с датчиком давления PT-204', executor: 'Иванова М. С.', group: 'АСУ ТП', dueDate: isoToday(), status: 'На сегодня', comment: 'Повторный выезд', priority: 'Высокий' },
  { id: 'НР-2407-0169', description: 'Плановая ревизия коммутационного оборудования', executor: 'Мусаев Т. К.', group: 'Сменная бригада №1', dueDate: shiftDate(-1), status: 'Просрочен', comment: '', priority: 'Высокий' },
  { id: 'НР-2407-0201', description: 'Настройка архива событий сервера АРМ', executor: 'Сериков Д. Н.', group: 'АСУ ТП', dueDate: shiftDate(2), status: 'В работе', comment: '', priority: 'Средний' },
]

const nextCheck = (from: Date) => {
  const candidate = new Date(from)
  const slot = [9, 16].find((hour) => hour > from.getHours() + from.getMinutes() / 60)
  if (slot !== undefined && from.getDay() >= 1 && from.getDay() <= 5) {
    candidate.setHours(slot, 0, 0, 0)
    return candidate
  }
  candidate.setDate(candidate.getDate() + 1)
  while (candidate.getDay() === 0 || candidate.getDay() === 6) candidate.setDate(candidate.getDate() + 1)
  candidate.setHours(9, 0, 0, 0)
  return candidate
}

const telegramText = (order: Order) => `Контроль сроков нарядов СУИСТ-1

Дата проверки: ${fmtDate(new Date())}

Наряд: ${order.id}
Срок выполнения: сегодня
Исполнитель: ${order.executor}
Группа: ${order.group}
Статус: ${order.status}
Описание: ${order.description}

Необходимо проверить наряд и выполнить одно из действий:
закрыть как выполненный, вернуть на доработку, внести комментарий или переназначить исполнителя.`

function App() {
  const [orders, setOrders] = useState(initialOrders)
  const [search, setSearch] = useState('')
  const [executor, setExecutor] = useState('Все исполнители')
  const [group, setGroup] = useState('Все группы')
  const [status, setStatus] = useState('На сегодня')
  const [lastCheck, setLastCheck] = useState<Date | null>(new Date(Date.now() - 42 * 60000))
  const [selectedId, setSelectedId] = useState(initialOrders[0].id)
  const [sent, setSent] = useState(false)
  const [running, setRunning] = useState(false)
  const [modal, setModal] = useState<{ order: Order; action: string } | null>(null)
  const [comment, setComment] = useState('')
  const [logs, setLogs] = useState<Log[]>([
    { id: 1, time: fmtTime(new Date(Date.now() - 38 * 60000)), order: 'НР-2407-0182', executor: 'Касымов А. Р.', action: 'Проверен', comment: 'Исполнитель подтвердил выезд' },
    { id: 2, time: fmtTime(new Date(Date.now() - 31 * 60000)), order: 'НР-2407-0186', executor: 'Иванова М. С.', action: 'Комментарий', comment: 'Запрошен результат проверки канала' },
  ])

  const todayOrders = orders.filter((order) => order.dueDate === isoToday())
  const filtered = todayOrders.filter((order) =>
    order.id.toLowerCase().includes(search.toLowerCase()) &&
    (executor === 'Все исполнители' || order.executor === executor) &&
    (group === 'Все группы' || order.group === group) &&
    (status === 'Все статусы' || order.status === status)
  )
  const selected = todayOrders.find((order) => order.id === selectedId) ?? todayOrders[0]
  const executors = [...new Set(todayOrders.map((order) => order.executor))]
  const groups = [...new Set(todayOrders.map((order) => order.group))]
  const executorCards = useMemo(() => executors.map((name) => ({
    name,
    group: todayOrders.find((order) => order.executor === name)!.group,
    ids: todayOrders.filter((order) => order.executor === name).map((order) => order.id),
  })), [orders])

  const runCheck = () => {
    setRunning(true)
    window.setTimeout(() => {
      setLastCheck(new Date())
      setRunning(false)
      setSent(false)
      setLogs((previous) => [{
        id: Date.now(), time: fmtTime(new Date()), order: 'СИСТЕМА', executor: 'Автоконтроль',
        action: 'Проверка выполнена', comment: `Выявлено нарядов на сегодня: ${todayOrders.length}`,
      }, ...previous])
    }, 750)
  }

  function sendTelegramNotification(order: Order) {
    setSent(true)
    setLogs((previous) => [{
      id: Date.now(), time: fmtTime(new Date()), order: order.id, executor: order.executor,
      action: 'Telegram отправлен', comment: 'Уведомление дежурному ООУ имитировано',
    }, ...previous])
  }

  const openAction = (order: Order, action: string) => {
    if (action === 'Проверить наряд') {
      setLogs((previous) => [{ id: Date.now(), time: fmtTime(new Date()), order: order.id, executor: order.executor, action: 'Проверен', comment: 'Наряд открыт дежурным ООУ' }, ...previous])
      return
    }
    setComment('')
    setModal({ order, action })
  }

  const commitAction = () => {
    if (!modal) return
    if (modal.action === 'Закрыть как выполненный') setOrders((previous) => previous.filter((order) => order.id !== modal.order.id))
    setLogs((previous) => [{ id: Date.now(), time: fmtTime(new Date()), order: modal.order.id, executor: modal.order.executor, action: modal.action, comment: comment || 'Без комментария' }, ...previous])
    setModal(null)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-[#081321]/90">
        <div className="mx-auto flex max-w-[1580px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400"><ShieldCheck size={22} /></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-sky-400">Оперативный контроль · ООУ</p><h1 className="text-lg font-semibold tracking-tight sm:text-xl">Контроль сроков нарядов <span className="text-slate-400">СУИСТ-1</span></h1></div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-emerald-400 sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Система активна</div>
        </div>
      </header>

      <main className="mx-auto max-w-[1580px] space-y-5 px-5 py-6 lg:px-8">
        <section className="grid overflow-hidden rounded-2xl border border-line bg-panel lg:grid-cols-[1.35fr_1fr]">
          <div className="relative overflow-hidden p-6 lg:p-8">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[.18em] text-slate-400"><Activity size={14} className="text-sky-400" /> Сводка на смену</p>
            <div className="flex flex-wrap items-end gap-x-7 gap-y-2"><strong className="font-mono text-5xl text-signal">{todayOrders.length.toString().padStart(2, '0')}</strong><div><h2 className="text-xl font-semibold">Наряды требуют контроля сегодня</h2><p className="mt-1 text-sm text-slate-400">{fmtDate(new Date())} · {new Date().toLocaleDateString('ru-RU', { weekday: 'long' })}</p></div></div>
          </div>
          <div className="grid grid-cols-2 border-t border-line lg:border-l lg:border-t-0">
            <Info label="Последняя проверка" value={lastCheck ? fmtTime(lastCheck) : 'Не выполнялась'} icon={<CheckCircle2 size={16} />} />
            <Info label="Следующая проверка" value={fmtTime(nextCheck(new Date()))} icon={<Clock3 size={16} />} />
            <div className="col-span-2 flex items-center justify-between gap-4 border-t border-line px-5 py-4">
              <div><p className="text-xs text-slate-400">Регламент</p><p className="mt-1 text-sm font-medium">Два раза в день по будням · 09:00 / 16:00</p></div>
              <button onClick={runCheck} disabled={running} className="flex shrink-0 items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-60"><RefreshCw size={16} className={running ? 'animate-spin' : ''} />{running ? 'Проверяем…' : 'Запустить сейчас'}</button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-panel">
          <div className="flex flex-col justify-between gap-4 border-b border-line p-5 xl:flex-row xl:items-center">
            <SectionTitle icon={<AlertTriangle size={18} />} title="Наряды со сроком на сегодня" count={filtered.length} />
            <div className="grid gap-2 sm:grid-cols-2 xl:flex">
              <label className="relative sm:col-span-2 xl:w-56"><Search size={15} className="absolute left-3 top-3 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Номер наряда" className="w-full rounded-lg border border-line bg-ink py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-sky-500" /></label>
              <Filter value={executor} onChange={setExecutor} options={['Все исполнители', ...executors]} />
              <Filter value={group} onChange={setGroup} options={['Все группы', ...groups]} />
              <Filter value={status} onChange={setStatus} options={['Все статусы', 'На сегодня', 'Просрочен', 'В работе']} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-[#091522] text-[10px] uppercase tracking-[.12em] text-slate-500"><tr><Th>Наряд / приоритет</Th><Th>Срок</Th><Th>Исполнитель</Th><Th>Группа</Th><Th>Описание</Th><Th>Статус</Th><Th>Рекомендация</Th></tr></thead>
              <tbody className="divide-y divide-line">
                {filtered.map((order) => <tr key={order.id} onClick={() => { setSelectedId(order.id); setSent(false) }} className={`cursor-pointer transition hover:bg-white/[.025] ${selectedId === order.id ? 'bg-sky-500/[.04]' : ''}`}>
                  <Td><p className="font-mono text-sm font-semibold text-sky-300">{order.id}</p><p className={`mt-1 text-[10px] font-semibold uppercase ${order.priority === 'Критический' ? 'text-red-400' : order.priority === 'Высокий' ? 'text-orange-400' : 'text-slate-500'}`}>{order.priority}</p></Td>
                  <Td><p className="text-sm">{fmtShort(order.dueDate)}</p><p className="mt-1 text-xs text-signal">Сегодня</p></Td>
                  <Td><p className="text-sm font-medium">{order.executor}</p></Td><Td><p className="text-xs text-slate-300">{order.group}</p></Td>
                  <Td><p className="max-w-sm text-xs leading-5 text-slate-300">{order.description}</p></Td>
                  <Td><Badge status={order.status} /></Td>
                  <Td><p className="flex items-center gap-2 text-xs font-medium text-signal"><ClipboardCheck size={14} /> Проверить до конца смены</p></Td>
                </tr>)}
              </tbody>
            </table>
            {!filtered.length && <div className="p-12 text-center text-sm text-slate-500">По заданным фильтрам наряды не найдены</div>}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
          <section className="rounded-2xl border border-line bg-panel p-5">
            <SectionTitle icon={<UsersRound size={18} />} title="Исполнители" count={executorCards.length} />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {executorCards.map((person) => <div key={person.name} className="rounded-xl border border-line bg-ink/60 p-4">
                <div className="flex justify-between"><div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-500/10 text-sky-400"><UserRound size={17} /></div><span className="font-mono text-2xl font-semibold text-signal">{person.ids.length}</span></div>
                <h3 className="mt-3 text-sm font-semibold">{person.name}</h3><p className="mt-1 text-xs text-slate-500">{person.group}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">{person.ids.map((id) => <button key={id} onClick={() => setSelectedId(id)} className="rounded bg-slate-800 px-2 py-1 font-mono text-[10px] text-sky-300 hover:bg-slate-700">{id}</button>)}</div>
              </div>)}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line p-5"><SectionTitle icon={<Bell size={18} />} title="Telegram-уведомление" /><span className="rounded-full bg-sky-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-sky-400">Демо-режим</span></div>
            {selected && <div className="p-5">
              <div className="rounded-xl border border-[#244b68] bg-[#0b263b] p-4 shadow-[0_12px_30px_rgba(0,0,0,.15)]">
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3"><div className="flex items-center gap-2 text-xs font-semibold text-sky-300"><Send size={15} /> Дежурный ООУ</div><span className="text-[10px] text-slate-500">предпросмотр</span></div>
                <pre className="whitespace-pre-wrap font-sans text-xs leading-[1.55] text-slate-200">{telegramText(selected)}</pre>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">{sent ? <span className="flex items-center gap-1.5 text-emerald-400"><Check size={14} /> Уведомление успешно имитировано</span> : 'Bot token не требуется'}</p>
                <button onClick={() => sendTelegramNotification(selected)} className="flex items-center gap-2 rounded-lg bg-[#2387c9] px-4 py-2.5 text-sm font-semibold hover:bg-[#319bdc]"><Send size={15} /> Отправить в Telegram</button>
              </div>
            </div>}
          </section>
        </div>

        <section className="rounded-2xl border border-line bg-panel">
          <div className="border-b border-line p-5"><SectionTitle icon={<ClipboardCheck size={18} />} title="Действия дежурного ООУ" /></div>
          <div className="divide-y divide-line">
            {filtered.map((order) => <div key={order.id} className="flex flex-col gap-4 p-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="min-w-[260px]"><div className="flex items-center gap-3"><span className="font-mono text-sm font-semibold text-sky-300">{order.id}</span><Badge status={order.status} /></div><p className="mt-1.5 text-xs text-slate-500">{order.executor} · {order.group}</p></div>
              <div className="flex flex-wrap gap-2">
                <Action icon={<FileSearch size={14} />} label="Проверить наряд" onClick={() => openAction(order, 'Проверить наряд')} />
                <Action icon={<CheckCircle2 size={14} />} label="Закрыть как выполненный" tone="green" onClick={() => openAction(order, 'Закрыть как выполненный')} />
                <Action icon={<RefreshCw size={14} />} label="Вернуть на доработку" tone="red" onClick={() => openAction(order, 'Вернуть на доработку')} />
                <Action icon={<MessageSquare size={14} />} label="Добавить комментарий" onClick={() => openAction(order, 'Добавить комментарий')} />
                <Action icon={<ArrowRightLeft size={14} />} label="Переназначить" onClick={() => openAction(order, 'Переназначить исполнителя')} />
              </div>
            </div>)}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="border-b border-line p-5"><SectionTitle icon={<History size={18} />} title="Журнал контроля" count={logs.length} /></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead className="bg-[#091522] text-[10px] uppercase tracking-[.12em] text-slate-500"><tr><Th>Дата и время</Th><Th>Наряд</Th><Th>Исполнитель</Th><Th>Действие</Th><Th>Комментарий</Th></tr></thead><tbody className="divide-y divide-line">{logs.map((log) => <tr key={log.id}><Td><span className="font-mono text-xs text-slate-400">{log.time}</span></Td><Td><span className="font-mono text-xs text-sky-300">{log.order}</span></Td><Td><span className="text-xs">{log.executor}</span></Td><Td><span className="text-xs font-medium">{log.action}</span></Td><Td><span className="text-xs text-slate-400">{log.comment}</span></Td></tr>)}</tbody></table></div>
        </section>
      </main>

      {modal && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-2xl">
          <div className="flex items-start justify-between"><div><p className="text-xs text-sky-400">{modal.order.id}</p><h3 className="mt-1 text-lg font-semibold">{modal.action}</h3></div><button onClick={() => setModal(null)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X size={18} /></button></div>
          <p className="mt-2 text-xs leading-5 text-slate-400">{modal.order.executor} · {modal.order.description}</p>
          <label className="mt-5 block text-xs font-medium text-slate-300">Комментарий дежурного</label>
          <textarea autoFocus value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Укажите результат или основание действия…" className="mt-2 h-28 w-full resize-none rounded-xl border border-line bg-ink p-3 text-sm outline-none focus:border-sky-500" />
          <div className="mt-4 flex justify-end gap-2"><button onClick={() => setModal(null)} className="rounded-lg px-4 py-2.5 text-sm text-slate-400 hover:bg-white/5">Отмена</button><button onClick={commitAction} className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold hover:bg-sky-400"><Check size={15} /> Подтвердить</button></div>
        </div>
      </div>}
    </div>
  )
}

function Info({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="border-r border-line px-5 py-4 last:border-r-0"><p className="flex items-center gap-2 text-xs text-slate-500">{icon}{label}</p><p className="mt-2 font-mono text-xs font-semibold text-slate-200">{value}</p></div>
}
function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return <div className="flex items-center gap-2.5"><span className="text-sky-400">{icon}</span><h2 className="text-sm font-semibold">{title}</h2>{count !== undefined && <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">{count}</span>}</div>
}
function Filter({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-line bg-ink px-3 py-2.5 text-xs text-slate-300 outline-none focus:border-sky-500">{options.map((option) => <option key={option}>{option}</option>)}</select>
}
function Badge({ status }: { status: Status }) {
  const color = status === 'На сегодня' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300' : status === 'Просрочен' ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
  return <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${color}`}>{status}</span>
}
function Action({ icon, label, tone = 'default', onClick }: { icon: React.ReactNode; label: string; tone?: 'default' | 'green' | 'red'; onClick: () => void }) {
  const color = tone === 'green' ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : tone === 'red' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-line text-slate-300 hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300'
  return <button onClick={onClick} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${color}`}>{icon}{label}<ChevronRight size={12} className="opacity-40" /></button>
}
function Th({ children }: { children: React.ReactNode }) { return <th className="px-5 py-3 font-semibold">{children}</th> }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-5 py-4 align-middle">{children}</td> }

export default App
