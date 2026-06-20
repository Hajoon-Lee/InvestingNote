import { useState, useEffect, useRef } from 'react'
import Calendar from 'react-calendar'
import { generateClient } from 'aws-amplify/data'

// ── 날짜 유틸 ──────────────────────────────────────────────
const toKey = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatDisplay = (date) =>
  date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

const today = new Date()
const todayKey = toKey(today)

const FILTERS = ['전체', '진행중', '완료']
const TABS = ['할 일', '예비 탭 1', '예비 탭 2']

// ── 캘린더 타일 콘텐츠 ─────────────────────────────────────
function TileContent({ date, todos }) {
  const key = toKey(date)
  const items = todos.filter(t => t.date === key)
  if (!items.length) return null
  const doneAll = items.every(t => t.done)
  return (
    <span
      className="tile-dot"
      style={{
        display: 'block',
        width: 5,
        height: 5,
        borderRadius: '50%',
        marginTop: 2,
        background: doneAll ? '#10b981' : '#3b82f6',
      }}
    />
  )
}

// ── 백엔드 미설정 안내 화면 ────────────────────────────────
function BackendSetupScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">⚙️</div>
        <h2 className="text-base font-semibold text-slate-800 mb-2">AWS 백엔드 배포가 필요합니다</h2>
        <p className="text-slate-500 text-sm mb-5 leading-relaxed">
          아래 명령어로 Amplify 샌드박스를 먼저 실행해 DynamoDB를 배포하세요.
        </p>
        <div className="bg-slate-50 rounded-xl p-3 text-left mb-4">
          <p className="text-xs text-slate-400 mb-1">터미널에서 실행</p>
          <code className="text-sm text-blue-600 font-mono">npx ampx sandbox</code>
        </div>
        <p className="text-slate-400 text-xs">
          배포 완료 후 이 페이지를 새로고침(F5)하세요.
        </p>
      </div>
    </div>
  )
}

// ── 로딩 스피너 ───────────────────────────────────────────
function Spinner() {
  return (
    <div className="py-14 text-center">
      <div className="inline-block w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      <p className="mt-3 text-slate-400 text-sm">클라우드에서 불러오는 중...</p>
    </div>
  )
}

// ── 메인 앱 ───────────────────────────────────────────────
export default function App() {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [backendError, setBackendError] = useState(false)
  const [selectedDate, setSelectedDate] = useState(today)
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('전체')
  const [activeTab, setActiveTab] = useState('할 일')

  // generateClient()는 반드시 Amplify.configure() 이후에 호출해야 하므로
  // 모듈 최상단이 아닌 useEffect(컴포넌트 마운트 이후)에서 초기화한다.
  const clientRef = useRef(null)

  useEffect(() => {
    try {
      clientRef.current = generateClient()
    } catch (err) {
      console.error('Amplify client error:', err)
      setBackendError(true)
      setLoading(false)
      return
    }

    const sub = clientRef.current.models.Todo.observeQuery().subscribe({
      next: ({ items }) => {
        setTodos([...items])
        setLoading(false)
      },
      error: (err) => {
        console.error('Amplify sync error:', err)
        setLoading(false)
      },
    })
    return () => sub.unsubscribe()
  }, [])

  const selectedKey = toKey(selectedDate)
  const dateTodos = todos.filter(t => t.date === selectedKey)
  const filtered = dateTodos.filter(t => {
    if (filter === '진행중') return !t.done
    if (filter === '완료') return t.done
    return true
  })
  const doneCount = dateTodos.filter(t => t.done).length

  const addTodo = async () => {
    const trimmed = input.trim()
    if (!trimmed || !clientRef.current) return
    setInput('')
    await clientRef.current.models.Todo.create({ date: selectedKey, text: trimmed, done: false })
  }

  const toggleTodo = async (id, currentDone) => {
    if (!clientRef.current) return
    await clientRef.current.models.Todo.update({ id, done: !currentDone })
  }

  const deleteTodo = async (id) => {
    if (!clientRef.current) return
    await clientRef.current.models.Todo.delete({ id })
  }

  const clearDone = async () => {
    if (!clientRef.current) return
    await Promise.all(
      dateTodos.filter(t => t.done).map(t => clientRef.current.models.Todo.delete({ id: t.id }))
    )
  }

  // 백엔드 미설정 상태
  if (backendError) return <BackendSetupScreen />

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">

      {/* ── 헤더 + 탭 바 ── */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-6 h-14">
            <span className="text-base font-bold text-slate-800 shrink-0">투자노트</span>
            <nav className="flex gap-1">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">

        {/* ── 비활성 탭 ── */}
        {activeTab !== '할 일' && (
          <div className="flex items-center justify-center min-h-64">
            <div className="text-center bg-white rounded-2xl border border-slate-100 shadow-sm px-10 py-12">
              <div className="text-3xl mb-3">🔧</div>
              <p className="text-slate-500 font-medium">예비 기능입니다.</p>
              <p className="text-slate-400 text-sm mt-1">준비 중입니다.</p>
            </div>
          </div>
        )}

        {/* ── 할 일 탭 ── */}
        {activeTab === '할 일' && (
          <div className="flex flex-col lg:flex-row gap-4 lg:items-start">

            {/* ── 캘린더 카드 ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 lg:w-80 shrink-0">
              <Calendar
                onChange={setSelectedDate}
                value={selectedDate}
                locale="ko-KR"
                calendarType="gregory"
                showFixedNumberOfWeeks={false}
                formatDay={(_locale, date) => date.getDate()}
                tileContent={({ date, view }) =>
                  view === 'month' ? <TileContent date={date} todos={todos} /> : null
                }
              />
              <div className="flex gap-4 mt-4 pt-3 border-t border-slate-50 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                  진행중
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                  모두 완료
                </span>
              </div>
            </div>

            {/* ── 날짜별 할 일 패널 ── */}
            <div className="flex-1 min-w-0">

              {/* 날짜 헤더 */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    {formatDisplay(selectedDate)}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {loading
                      ? '동기화 중...'
                      : dateTodos.length === 0
                      ? '할 일 없음'
                      : `${dateTodos.length}개 중 ${doneCount}개 완료`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {loading && (
                    <span className="inline-block w-4 h-4 border-2 border-blue-200 border-t-blue-400 rounded-full animate-spin" />
                  )}
                  {selectedKey === todayKey && (
                    <span className="text-xs font-medium text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full">
                      오늘
                    </span>
                  )}
                </div>
              </div>

              {/* 입력 카드 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-3">
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50"
                    placeholder={`${formatDisplay(selectedDate)}에 추가할 일`}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTodo()}
                    disabled={loading}
                  />
                  <button
                    onClick={addTodo}
                    disabled={loading || !input.trim()}
                    className="bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all whitespace-nowrap"
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* 필터 탭 */}
              <div className="flex gap-1 mb-3 bg-slate-100 rounded-xl p-1">
                {FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-all ${
                      filter === f
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {f}
                    {f !== '전체' && (
                      <span className="ml-1 text-xs">
                        ({f === '진행중'
                          ? dateTodos.filter(t => !t.done).length
                          : doneCount})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* 할 일 목록 카드 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                  <Spinner />
                ) : filtered.length === 0 ? (
                  <div className="py-14 text-center">
                    <p className="text-slate-300 text-sm">
                      {filter === '완료'
                        ? '완료된 항목이 없어요'
                        : filter === '진행중'
                        ? '모두 완료했어요!'
                        : '이 날의 할 일을 추가해보세요'}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {filtered.map(todo => (
                      <li
                        key={todo.id}
                        className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors group"
                      >
                        <button
                          onClick={() => toggleTodo(todo.id, todo.done)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            todo.done
                              ? 'bg-emerald-400 border-emerald-400'
                              : 'border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          {todo.done && (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                        <span
                          className={`flex-1 text-sm leading-snug transition-colors ${
                            todo.done ? 'line-through text-slate-300' : 'text-slate-700'
                          }`}
                        >
                          {todo.text}
                        </span>
                        <button
                          onClick={() => deleteTodo(todo.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all p-1 rounded-lg hover:bg-red-50"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {!loading && doneCount > 0 && (
                <button
                  onClick={clearDone}
                  className="mt-3 w-full text-xs text-slate-400 hover:text-red-400 py-2 transition-colors"
                >
                  완료된 항목 {doneCount}개 모두 삭제
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
