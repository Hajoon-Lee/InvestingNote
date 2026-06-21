import { useState, useEffect, useRef } from 'react'
import Calendar from 'react-calendar'
import { generateClient } from 'aws-amplify/data'
import { priceService } from './priceService'

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

const TABS = ['일정관리', '투자메모', '예비 탭 2']
const WORK_CATEGORIES = ['기업탐방', 'NDR/IR', '세미나', '보고서/제안서', '컴플라이언스', 'Presentation', '기타']
const EVENT_CATEGORIES = ['실적발표', '매크로', '카탈리스트', '뉴스', '아이디어 점검', '수급/리밸런싱', '정책/규제', '기타']
const MOCK_STOCKS = [
  { name: '삼성전자', ticker: '005930.KS' },
  { name: 'SK하이닉스', ticker: '000660.KS' },
  { name: 'NAVER', ticker: '035420.KS' },
  { name: '카카오', ticker: '035720.KS' },
  { name: 'NVIDIA', ticker: 'NVDA' },
  { name: 'Tesla', ticker: 'TSLA' },
  { name: 'Microsoft', ticker: 'MSFT' },
  { name: 'Apple', ticker: 'AAPL' },
]

const calcHoldingDays = (openDate, closeDate) =>
  Math.max(0, Math.floor(((closeDate ? new Date(closeDate) : new Date()) - new Date(openDate)) / 86400000))

const calcReturnFromPrices = (position, openPrice, endPrice) => {
  if (!openPrice || !endPrice) return null
  if (position === 'LONG') return ((endPrice - openPrice) / openPrice * 100).toFixed(1)
  return ((openPrice - endPrice) / openPrice * 100).toFixed(1)
}

const formatPrice = (n) => (n != null ? n.toLocaleString('ko-KR') : null)

// ── 아이디어별 가격 데이터 훅 ─────────────────────────────
function useIdeaPrices(ideaGroups) {
  const [prices, setPrices] = useState({})

  useEffect(() => {
    if (!ideaGroups.length) return
    let cancelled = false

    const fetchAll = async () => {
      const results = {}
      await Promise.all(
        ideaGroups.map(async (idea) => {
          try {
            const [openPrice, endPrice, history] = await Promise.all([
              priceService.getClosePriceOnOrBeforeDate(idea.ticker, idea.openDate),
              idea.closeDate
                ? priceService.getClosePriceOnOrBeforeDate(idea.ticker, idea.closeDate)
                : priceService.getLatestClosePrice(idea.ticker),
              priceService.getPriceHistory(idea.ticker, idea.openDate, idea.closeDate),
            ])
            results[idea.id] = { openPrice, endPrice, history, error: false }
          } catch {
            results[idea.id] = { openPrice: null, endPrice: null, history: [], error: true }
          }
        })
      )
      if (!cancelled) setPrices(results)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [ideaGroups])

  return prices
}

// ── 캘린더 타일 콘텐츠 ─────────────────────────────────────
function TileContent({ date, schedules }) {
  const key = toKey(date)
  const items = schedules.filter(s => {
    if (s.endDate) return key >= s.date && key <= s.endDate
    return s.date === key
  })
  if (!items.length) return null
  const hasWork = items.some(s => s.type === '업무 일정')
  const hasEvent = items.some(s => s.type === '투자 이벤트')
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 2 }}>
      {hasWork && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', display: 'block' }} />}
      {hasEvent && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'block' }} />}
    </div>
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

// ── 미니 차트 ─────────────────────────────────────────────
function MiniChart({ prices, positive }) {
  if (!prices || prices.length < 2) return null
  const w = 400, h = 100, pad = 8
  const min = Math.min(...prices), max = Math.max(...prices)
  const range = max - min || 1
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (w - 2 * pad)
    const y = h - pad - ((p - min) / range) * (h - 2 * pad)
    return `${x},${y}`
  }).join(' ')
  const color = positive ? '#10b981' : '#ef4444'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 100 }}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pad},${h - pad} ${pts} ${w - pad},${h - pad}`} fill="url(#cg)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

// ── 메인 앱 ───────────────────────────────────────────────
export default function App() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [backendError, setBackendError] = useState(false)
  const [selectedDate, setSelectedDate] = useState(today)
  const [activeTab, setActiveTab] = useState('일정관리')
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    type: '업무 일정', category: '기업탐방', date: todayKey, endDate: '', time: '', memo: '', linkedIdeaId: '',
  })

  const [ideaGroups, setIdeaGroups] = useState([])
  const [ideaMemos, setIdeaMemos] = useState([])
  const [ideasLoading, setIdeasLoading] = useState(true)
  const [ideaStatusFilter, setIdeaStatusFilter] = useState('전체')
  const [showIdeaForm, setShowIdeaForm] = useState(false)
  const [ideaForm, setIdeaForm] = useState({ stockName: '', ticker: '', position: 'LONG', thesis: '', risk: '' })
  const [showStockDropdown, setShowStockDropdown] = useState(false)
  const [selectedIdeaId, setSelectedIdeaId] = useState(null)
  const [showUpdateForm, setShowUpdateForm] = useState(false)
  const [updateForm, setUpdateForm] = useState({ thesis: '', risk: '' })
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [closeForm, setCloseForm] = useState({ thesis: '', risk: '' })

  const ideaPrices = useIdeaPrices(ideaGroups)

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

    const scheduleSub = clientRef.current.models.Schedule.observeQuery().subscribe({
      next: ({ items }) => {
        setSchedules([...items])
        setLoading(false)
      },
      error: (err) => {
        console.error('Schedule sync error:', err)
        setLoading(false)
      },
    })

    const groupSub = clientRef.current.models.InvestmentIdeaGroup.observeQuery().subscribe({
      next: ({ items }) => {
        setIdeaGroups([...items])
        setIdeasLoading(false)
      },
      error: (err) => {
        console.error('IdeaGroup sync error:', err)
        setIdeasLoading(false)
      },
    })

    const memoSub = clientRef.current.models.InvestmentMemo.observeQuery().subscribe({
      next: ({ items }) => setIdeaMemos([...items]),
      error: (err) => console.error('Memo sync error:', err),
    })

    return () => {
      scheduleSub.unsubscribe()
      groupSub.unsubscribe()
      memoSub.unsubscribe()
    }
  }, [])

  const selectedKey = toKey(selectedDate)
  const dateSchedules = schedules.filter(s => {
    if (s.endDate) return selectedKey >= s.date && selectedKey <= s.endDate
    return s.date === selectedKey
  }).sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time)
    if (a.time) return -1
    if (b.time) return 1
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })

  const addSchedule = async () => {
    if (!scheduleForm.date || !clientRef.current) return
    await clientRef.current.models.Schedule.create({
      type: scheduleForm.type,
      category: scheduleForm.category,
      date: scheduleForm.date,
      endDate: scheduleForm.endDate || null,
      time: scheduleForm.time || null,
      memo: scheduleForm.memo.trim() || null,
      linkedIdeaId: scheduleForm.linkedIdeaId || null,
    })
    setShowScheduleForm(false)
    setScheduleForm({ type: '업무 일정', category: '기업탐방', date: todayKey, endDate: '', time: '', memo: '', linkedIdeaId: '' })
  }

  const deleteSchedule = async (id) => {
    if (!clientRef.current) return
    await clientRef.current.models.Schedule.delete({ id })
  }

  const upcomingSchedules = (() => {
    const limit = new Date(today)
    limit.setDate(limit.getDate() + 30)
    const limitKey = toKey(limit)
    return schedules
      .filter(s => (s.endDate || s.date) >= todayKey && s.date <= limitKey)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
  })()

  const calcDDay = (dateStr) => {
    const diff = Math.ceil((new Date(dateStr + 'T00:00:00') - new Date(todayKey + 'T00:00:00')) / 86400000)
    if (diff === 0) return 'D-Day'
    if (diff > 0) return `D-${diff}`
    return `D+${Math.abs(diff)}`
  }

  const dDayColor = (dateStr) => {
    const diff = Math.ceil((new Date(dateStr + 'T00:00:00') - new Date(todayKey + 'T00:00:00')) / 86400000)
    if (diff <= 0) return 'bg-red-500 text-white'
    if (diff <= 3) return 'bg-orange-100 text-orange-700'
    if (diff <= 7) return 'bg-amber-50 text-amber-600'
    return 'bg-slate-100 text-slate-500'
  }

  // ── 투자메모 CRUD ──
  const openIdea = async () => {
    if (!ideaForm.stockName.trim() || !ideaForm.ticker || !ideaForm.thesis.trim() || !ideaForm.risk.trim() || !clientRef.current) return
    const { data: group } = await clientRef.current.models.InvestmentIdeaGroup.create({
      stockName: ideaForm.stockName.trim(),
      ticker: ideaForm.ticker,
      position: ideaForm.position,
      status: 'OPEN',
      openDate: todayKey,
    })
    await clientRef.current.models.InvestmentMemo.create({
      ideaGroupId: group.id,
      ticker: ideaForm.ticker,
      memoType: 'OPEN',
      thesis: ideaForm.thesis.trim(),
      risk: ideaForm.risk.trim(),
    })
    setShowIdeaForm(false)
    setIdeaForm({ stockName: '', ticker: '', position: 'LONG', thesis: '', risk: '' })
  }

  const addIdeaUpdate = async () => {
    if (!selectedIdeaId || (!updateForm.thesis.trim() && !updateForm.risk.trim()) || !clientRef.current) return
    const idea = ideaGroups.find(g => g.id === selectedIdeaId)
    if (!idea) return
    await clientRef.current.models.InvestmentMemo.create({
      ideaGroupId: selectedIdeaId,
      ticker: idea.ticker,
      memoType: 'UPDATE',
      thesis: updateForm.thesis.trim() || '',
      risk: updateForm.risk.trim() || '',
    })
    setShowUpdateForm(false)
    setUpdateForm({ thesis: '', risk: '' })
  }

  const closeIdea = async () => {
    if (!selectedIdeaId || !clientRef.current) return
    const idea = ideaGroups.find(g => g.id === selectedIdeaId)
    if (!idea) return
    await clientRef.current.models.InvestmentIdeaGroup.update({
      id: selectedIdeaId,
      status: 'CLOSED',
      closeDate: todayKey,
    })
    await clientRef.current.models.InvestmentMemo.create({
      ideaGroupId: selectedIdeaId,
      ticker: idea.ticker,
      memoType: 'CLOSE',
      thesis: closeForm.thesis.trim() || '',
      risk: closeForm.risk.trim() || '',
    })
    setShowCloseForm(false)
    setCloseForm({ thesis: '', risk: '' })
  }

  const selectedIdea = selectedIdeaId ? ideaGroups.find(g => g.id === selectedIdeaId) : null
  const selectedMemos = selectedIdeaId
    ? ideaMemos.filter(m => m.ideaGroupId === selectedIdeaId).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    : []
  const filteredIdeas = ideaGroups
    .filter(g => ideaStatusFilter === '전체' || g.status === ideaStatusFilter)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

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

        {/* ── 예비 탭 (미구현) ── */}
        {activeTab === '예비 탭 2' && (
          <div className="flex items-center justify-center min-h-64">
            <div className="text-center bg-white rounded-2xl border border-slate-100 shadow-sm px-10 py-12">
              <div className="text-3xl mb-3">🔧</div>
              <p className="text-slate-500 font-medium">예비 기능입니다.</p>
              <p className="text-slate-400 text-sm mt-1">준비 중입니다.</p>
            </div>
          </div>
        )}

        {/* ── 투자메모 탭 ── */}
        {activeTab === '투자메모' && (
          <div className="flex flex-col gap-4">
            {selectedIdea ? (
              <>
                {/* 뒤로가기 */}
                <button
                  onClick={() => { setSelectedIdeaId(null); setShowUpdateForm(false); setShowCloseForm(false) }}
                  className="self-start text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  목록으로
                </button>

                {/* 헤더 카드 */}
                <div className={`bg-white rounded-2xl shadow-sm border p-5 ${selectedIdea.status === 'OPEN' ? 'border-emerald-200' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-slate-800 truncate">{selectedIdea.stockName}</h2>
                      <p className="text-sm text-slate-400">{selectedIdea.ticker}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
                        selectedIdea.position === 'LONG' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                      }`}>{selectedIdea.position}</span>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
                        selectedIdea.status === 'OPEN' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      }`}>{selectedIdea.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
                    <span>Open: {selectedIdea.openDate}</span>
                    {selectedIdea.closeDate && <span>Close: {selectedIdea.closeDate}</span>}
                    <span>{calcHoldingDays(selectedIdea.openDate, selectedIdea.closeDate)}일 보유</span>
                  </div>
                </div>

                {/* 타임라인 카드 */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-4">메모 타임라인</h3>
                  <div>
                    {selectedMemos.map((memo, i) => (
                      <div key={memo.id} className="relative pl-8 pb-6 last:pb-0">
                        {i < selectedMemos.length - 1 && (
                          <div className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-200" />
                        )}
                        <div className={`absolute left-1 top-1.5 w-4 h-4 rounded-full border-2 ${
                          memo.memoType === 'OPEN' ? 'bg-emerald-400 border-emerald-400' :
                          memo.memoType === 'CLOSE' ? 'bg-slate-400 border-slate-400' :
                          'bg-blue-400 border-blue-400'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              memo.memoType === 'OPEN' ? 'bg-emerald-50 text-emerald-600' :
                              memo.memoType === 'CLOSE' ? 'bg-slate-100 text-slate-500' :
                              'bg-blue-50 text-blue-600'
                            }`}>{memo.memoType}</span>
                            <span className="text-xs text-slate-400">
                              {memo.createdAt ? new Date(memo.createdAt).toLocaleString('ko-KR') : ''}
                            </span>
                          </div>
                          {memo.thesis && (
                            <p className="text-sm text-slate-700 mb-1">
                              <span className="font-medium text-slate-400">투자논리: </span>{memo.thesis}
                            </p>
                          )}
                          {memo.risk && (
                            <p className="text-sm text-slate-700">
                              <span className="font-medium text-slate-400">리스크: </span>{memo.risk}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedIdea.status === 'OPEN' && !showUpdateForm && !showCloseForm && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => setShowUpdateForm(true)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 active:scale-[0.97] text-white text-sm font-medium py-2.5 rounded-xl transition-all shadow-sm shadow-blue-500/20"
                      >+ 메모 추가</button>
                      <button
                        onClick={() => setShowCloseForm(true)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] text-slate-600 text-sm font-medium py-2.5 rounded-xl transition-all"
                      >Close Idea</button>
                    </div>
                  )}

                  {selectedIdea.status === 'OPEN' && showUpdateForm && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700">메모 추가</h4>
                      <textarea
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none"
                        rows={3} placeholder={"1. 왜 싸다고 생각하는가? (Valuation)\n2. 언제 시장이 알아줄 것인가? (Catalyst)\n3. 시장이 틀린 점은 무엇인가? (Variant Perception)"} value={updateForm.thesis}
                        onChange={e => setUpdateForm(f => ({ ...f, thesis: e.target.value }))}
                      />
                      <textarea
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none"
                        rows={2} placeholder="무엇이 틀릴 수 있는가?" value={updateForm.risk}
                        onChange={e => setUpdateForm(f => ({ ...f, risk: e.target.value }))}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setShowUpdateForm(false); setUpdateForm({ thesis: '', risk: '' }) }}
                          className="text-sm text-slate-400 hover:text-slate-600 px-4 py-2 rounded-xl transition-colors">취소</button>
                        <button onClick={addIdeaUpdate} disabled={!updateForm.thesis.trim() && !updateForm.risk.trim()}
                          className="bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all">추가</button>
                      </div>
                    </div>
                  )}

                  {selectedIdea.status === 'OPEN' && showCloseForm && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                      <h4 className="text-sm font-semibold text-red-500">아이디어 종료</h4>
                      <textarea
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none"
                        rows={3} placeholder="종료 사유 / 최종 투자논리" value={closeForm.thesis}
                        onChange={e => setCloseForm(f => ({ ...f, thesis: e.target.value }))}
                      />
                      <textarea
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none"
                        rows={2} placeholder="사후 리스크 평가" value={closeForm.risk}
                        onChange={e => setCloseForm(f => ({ ...f, risk: e.target.value }))}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setShowCloseForm(false); setCloseForm({ thesis: '', risk: '' }) }}
                          className="text-sm text-slate-400 hover:text-slate-600 px-4 py-2 rounded-xl transition-colors">취소</button>
                        <button onClick={closeIdea}
                          className="bg-red-500 hover:bg-red-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all">종료 확정</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Performance 카드 */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Performance</h3>
                  {(() => {
                    const pd = ideaPrices[selectedIdea.id]
                    const openPrice = pd?.openPrice ?? null
                    const endPrice = pd?.endPrice ?? null
                    const prices = pd?.history ?? []
                    const ret = calcReturnFromPrices(selectedIdea.position, openPrice, endPrice)
                    const days = calcHoldingDays(selectedIdea.openDate, selectedIdea.closeDate)
                    const priceLoading = !pd
                    return (
                      <>
                        <div className="flex flex-wrap gap-6 mb-4">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Return</p>
                            {priceLoading ? (
                              <p className="text-sm font-medium text-slate-300">-</p>
                            ) : ret != null ? (
                              <p className={`text-2xl font-bold tabular-nums ${Number(ret) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {Number(ret) >= 0 ? '+' : ''}{ret}%
                              </p>
                            ) : (
                              <p className="text-sm font-medium text-slate-400">가격 데이터 연결 전</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Holding Days</p>
                            <p className="text-xl font-bold text-slate-700 tabular-nums">{days}일</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Open Price</p>
                            {priceLoading ? (
                              <p className="text-sm text-slate-300">-</p>
                            ) : openPrice != null ? (
                              <p className="text-sm font-semibold text-slate-600">{formatPrice(openPrice)}</p>
                            ) : (
                              <p className="text-sm text-slate-400">가격 데이터 연결 전</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">{selectedIdea.closeDate ? 'Close Price' : 'Current Price'}</p>
                            {priceLoading ? (
                              <p className="text-sm text-slate-300">-</p>
                            ) : endPrice != null ? (
                              <p className="text-sm font-semibold text-slate-600">{formatPrice(endPrice)}</p>
                            ) : (
                              <p className="text-sm text-slate-400">가격 데이터 연결 전</p>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-400 mb-2">Price Chart</p>
                          {priceLoading ? (
                            <p className="text-sm text-slate-300 text-center py-6">-</p>
                          ) : prices.length > 0 ? (
                            <MiniChart prices={prices} positive={ret != null && Number(ret) >= 0} />
                          ) : (
                            <p className="text-sm text-slate-400 text-center py-6">가격 데이터 연결 전</p>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>
              </>
            ) : (
              <>
                {/* 목록 헤더 */}
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 tracking-tight">투자메모</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {ideasLoading ? '동기화 중...' : `총 ${ideaGroups.length}개 아이디어`}
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowIdeaForm(true); setIdeaForm({ stockName: '', ticker: '', position: 'LONG', thesis: '', risk: '' }) }}
                    disabled={ideasLoading}
                    className="bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all shadow-sm shadow-emerald-500/20"
                  >+ 아이디어 오픈</button>
                </div>

                {/* 아이디어 오픈 폼 */}
                {showIdeaForm && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="text-sm font-bold text-slate-800">새 아이디어 오픈</h3>
                    </div>
                    <div className="p-6 space-y-5">
                      <div className="relative">
                        <input
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                          placeholder="종목명 검색 (예: 삼성전자, NVIDIA)"
                          value={ideaForm.stockName}
                          onChange={e => { setIdeaForm(f => ({ ...f, stockName: e.target.value, ticker: '' })); setShowStockDropdown(true) }}
                          onFocus={() => ideaForm.stockName && !ideaForm.ticker && setShowStockDropdown(true)}
                          onBlur={() => setShowStockDropdown(false)}
                        />
                        {ideaForm.ticker && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                            {ideaForm.ticker}
                          </span>
                        )}
                        {showStockDropdown && ideaForm.stockName && !ideaForm.ticker && (() => {
                          const matches = MOCK_STOCKS.filter(s =>
                            s.name.toLowerCase().includes(ideaForm.stockName.toLowerCase()) ||
                            s.ticker.toLowerCase().includes(ideaForm.stockName.toLowerCase())
                          )
                          if (!matches.length) return null
                          return (
                            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20 mt-1 overflow-hidden">
                              {matches.map(s => (
                                <button
                                  key={s.ticker}
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => { setIdeaForm(f => ({ ...f, stockName: s.name, ticker: s.ticker })); setShowStockDropdown(false) }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm flex justify-between"
                                >
                                  <span className="font-medium text-slate-700">{s.name}</span>
                                  <span className="text-slate-400">{s.ticker}</span>
                                </button>
                              ))}
                            </div>
                          )
                        })()}
                      </div>

                      <div className="bg-slate-100 rounded-xl p-1 flex">
                        {['LONG', 'SHORT'].map(pos => (
                          <button
                            key={pos} type="button"
                            onClick={() => setIdeaForm(f => ({ ...f, position: pos }))}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                              ideaForm.position === pos
                                ? 'bg-white shadow-sm ' + (pos === 'LONG' ? 'text-red-500' : 'text-blue-500')
                                : 'text-slate-400 hover:text-slate-500'
                            }`}
                          >{pos}</button>
                        ))}
                      </div>

                      <textarea
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none"
                        rows={3} placeholder="투자논리" value={ideaForm.thesis}
                        onChange={e => setIdeaForm(f => ({ ...f, thesis: e.target.value }))}
                      />
                      <textarea
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none"
                        rows={2} placeholder="리스크" value={ideaForm.risk}
                        onChange={e => setIdeaForm(f => ({ ...f, risk: e.target.value }))}
                      />

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <button onClick={() => setShowIdeaForm(false)}
                          className="text-sm text-slate-400 hover:text-slate-600 px-4 py-2.5 rounded-xl transition-colors">취소</button>
                        <button onClick={openIdea}
                          disabled={!ideaForm.stockName.trim() || !ideaForm.ticker || !ideaForm.thesis.trim() || !ideaForm.risk.trim()}
                          className="bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-all shadow-sm shadow-emerald-500/20"
                        >아이디어 오픈</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 필터 바 */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                  {['전체', 'OPEN', 'CLOSED'].map(f => (
                    <button key={f} onClick={() => setIdeaStatusFilter(f)}
                      className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-all ${
                        ideaStatusFilter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {f}
                      {f !== '전체' && (
                        <span className="ml-1 text-xs">({ideaGroups.filter(g => g.status === f).length})</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* 카드 리스트 */}
                {ideasLoading ? (
                  <Spinner />
                ) : filteredIdeas.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 text-center">
                    <div className="text-3xl mb-3 opacity-80">💡</div>
                    <p className="text-slate-600 font-semibold text-sm mb-1">
                      {ideaGroups.length === 0 ? '아직 등록된 아이디어가 없습니다' : '해당하는 아이디어가 없습니다'}
                    </p>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-56 mx-auto mb-5">
                      종목의 투자논리와 리스크를<br />체계적으로 기록해보세요.
                    </p>
                    {ideaGroups.length === 0 && (
                      <button onClick={() => { setShowIdeaForm(true); setIdeaForm({ stockName: '', ticker: '', position: 'LONG', thesis: '', risk: '' }) }}
                        className="bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-white text-xs font-medium px-4 py-2 rounded-xl transition-all shadow-sm shadow-emerald-500/20"
                      >+ 아이디어 오픈</button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredIdeas.map(idea => {
                      const openMemo = ideaMemos.find(m => m.ideaGroupId === idea.id && m.memoType === 'OPEN')
                      const pd = ideaPrices[idea.id]
                      const ret = pd ? calcReturnFromPrices(idea.position, pd.openPrice, pd.endPrice) : null
                      const days = calcHoldingDays(idea.openDate, idea.closeDate)
                      const isOpen = idea.status === 'OPEN'
                      return (
                        <div key={idea.id} onClick={() => setSelectedIdeaId(idea.id)}
                          className={`bg-white rounded-xl border border-slate-100 border-l-[3px] p-4 cursor-pointer transition-all hover:shadow-md hover:border-slate-200 ${
                            isOpen ? 'border-l-emerald-400' : 'border-l-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 truncate block">{idea.stockName}</span>
                              <span className="text-xs text-slate-400">{idea.ticker}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                idea.position === 'LONG' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                              }`}>{idea.position}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                              }`}>{idea.status}</span>
                            </div>
                          </div>
                          {openMemo && (
                            <div className="mb-3 space-y-1">
                              <p className="text-sm text-slate-500 truncate"><span className="text-slate-400 text-xs">논리: </span>{openMemo.thesis}</p>
                              <p className="text-sm text-slate-500 truncate"><span className="text-slate-400 text-xs">리스크: </span>{openMemo.risk}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-xs text-slate-400 pt-2.5 border-t border-slate-50">
                            {ret != null && (
                              <span className={`text-sm font-bold tabular-nums ${Number(ret) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {Number(ret) >= 0 ? '+' : ''}{ret}%
                              </span>
                            )}
                            <span>{days}일</span>
                            <span className="ml-auto font-mono tabular-nums">{idea.openDate}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── 일정관리 탭 ── */}
        {activeTab === '일정관리' && (
          <div className="space-y-10">

            {/* ══════════════════════════════════════════════════
                섹션 1: 다가오는 이벤트 (Dashboard Hero)
               ══════════════════════════════════════════════════ */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <span className="text-base">🔥</span> 다가오는 이벤트
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {loading ? '동기화 중...' : `Next 30 Days · ${upcomingSchedules.length}건`}
                  </p>
                </div>
                <button
                  onClick={() => setShowScheduleForm(v => !v)}
                  disabled={loading}
                  className="bg-blue-500 hover:bg-blue-600 active:scale-[0.97] disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all shadow-sm shadow-blue-500/20"
                >+ 일정 추가</button>
              </div>

              {/* 일정 추가 폼 */}
              {showScheduleForm && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-5 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-sm font-bold text-slate-800">새 일정</h3>
                  </div>
                  <div className="p-6 space-y-5">
                    <div className="bg-slate-100 rounded-xl p-1 flex">
                      {['업무 일정', '투자 이벤트'].map(t => (
                        <button key={t} type="button"
                          onClick={() => setScheduleForm(f => ({
                            ...f, type: t,
                            category: t === '업무 일정' ? WORK_CATEGORIES[0] : EVENT_CATEGORIES[0],
                          }))}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            scheduleForm.type === t
                              ? 'bg-white shadow-sm ' + (t === '업무 일정' ? 'text-blue-600' : 'text-amber-600')
                              : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >{t === '업무 일정' ? '🏢 ' : '📈 '}{t}</button>
                      ))}
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
                        <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 13H2V4h4l2 2h6v7z"/></svg>
                        카테고리
                      </label>
                      <select value={scheduleForm.category}
                        onChange={e => setScheduleForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-white"
                      >
                        {(scheduleForm.type === '업무 일정' ? WORK_CATEGORIES : EVENT_CATEGORIES).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
                        <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5.5 1.5v3M10.5 1.5v3"/></svg>
                        날짜 및 시간
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input type="date" value={scheduleForm.date}
                            onChange={e => setScheduleForm(f => ({ ...f, date: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                          />
                          <p className="text-[10px] text-slate-400 mt-1 pl-1">날짜</p>
                        </div>
                        <div className="flex-1">
                          <input type="date" value={scheduleForm.endDate}
                            onChange={e => setScheduleForm(f => ({ ...f, endDate: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                          />
                          <p className="text-[10px] text-slate-400 mt-1 pl-1">종료일 (선택)</p>
                        </div>
                        <div className="flex-1">
                          <input type="time" value={scheduleForm.time}
                            onChange={e => setScheduleForm(f => ({ ...f, time: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                          />
                          <p className="text-[10px] text-slate-400 mt-1 pl-1">시간 (선택)</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
                        <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12.5h4M6.5 14h3M8 2a4.5 4.5 0 012.5 8.2V12h-5v-1.8A4.5 4.5 0 018 2z"/></svg>
                        연결 아이디어
                      </label>
                      <select value={scheduleForm.linkedIdeaId}
                        onChange={e => setScheduleForm(f => ({ ...f, linkedIdeaId: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-white"
                      >
                        <option value="">연결 안 함</option>
                        {ideaGroups.map(g => (
                          <option key={g.id} value={g.id}>{g.stockName} ({g.ticker})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
                        <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z"/></svg>
                        내용
                      </label>
                      <textarea
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none leading-relaxed"
                        rows={3} placeholder="일정 내용을 입력하세요" value={scheduleForm.memo}
                        onChange={e => setScheduleForm(f => ({ ...f, memo: e.target.value }))}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                      <button onClick={() => setShowScheduleForm(false)}
                        className="text-sm text-slate-400 hover:text-slate-600 px-4 py-2.5 rounded-xl transition-colors">취소</button>
                      <button onClick={addSchedule}
                        className="bg-blue-500 hover:bg-blue-600 active:scale-[0.97] text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-500/20"
                      >추가</button>
                    </div>
                  </div>
                </div>
              )}

              {/* 다가오는 이벤트 카드 */}
              {loading ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm"><Spinner /></div>
              ) : upcomingSchedules.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 text-center">
                  <div className="text-3xl mb-3 opacity-80">📅</div>
                  <p className="text-slate-600 font-semibold text-sm mb-1">예정된 일정이 없습니다</p>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-56 mx-auto mb-5">
                    기업탐방, 실적발표, 매크로 이벤트,<br />
                    아이디어 점검 등을 기록해보세요.
                  </p>
                  <button onClick={() => setShowScheduleForm(true)}
                    className="bg-blue-500 hover:bg-blue-600 active:scale-[0.97] text-white text-xs font-medium px-4 py-2 rounded-xl transition-all shadow-sm shadow-blue-500/20"
                  >+ 일정 추가</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {upcomingSchedules.map(s => {
                    const linkedIdea = s.linkedIdeaId ? ideaGroups.find(g => g.id === s.linkedIdeaId) : null
                    const isWork = s.type === '업무 일정'
                    return (
                      <div key={s.id} className={`bg-white rounded-xl border border-slate-100 border-l-[3px] p-4 hover:shadow-md hover:border-slate-200 transition-all group flex flex-col ${
                        isWork ? 'border-l-blue-400' : 'border-l-amber-400'
                      }`}>
                        <div className="flex items-start justify-between mb-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${
                            isWork ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {isWork ? '🏢' : '📈'} {s.type}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${dDayColor(s.date)}`}>
                              {calcDDay(s.date)}
                            </span>
                            <button onClick={() => deleteSchedule(s.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all p-1 rounded-lg hover:bg-red-50">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mb-1 font-medium">{s.category}</p>
                        {s.memo && <p className="text-sm text-slate-800 font-medium leading-relaxed mb-3">{s.memo}</p>}
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-50 mt-auto">
                          <div>
                            {linkedIdea && (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                                💡 {linkedIdea.stockName}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-mono tabular-nums">
                            {s.date.replace(/-/g, '.')}{s.time ? ` ${s.time}` : ''}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ══════════════════════════════════════════════════
                섹션 2: 전체 일정 캘린더 (보조)
               ══════════════════════════════════════════════════ */}
            <section>
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                <span>📅</span> 전체 일정 캘린더
              </h3>
              <div className="flex flex-col lg:flex-row gap-5 lg:items-start">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 lg:w-80 shrink-0">
                  <Calendar
                    onChange={setSelectedDate}
                    value={selectedDate}
                    locale="ko-KR"
                    calendarType="gregory"
                    showFixedNumberOfWeeks={false}
                    formatDay={(_locale, date) => date.getDate()}
                    tileContent={({ date, view }) =>
                      view === 'month' ? <TileContent date={date} schedules={schedules} /> : null
                    }
                  />
                  <div className="flex gap-5 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                      업무 일정
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                      투자 이벤트
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{formatDisplay(selectedDate)}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {dateSchedules.length === 0 ? '일정 없음' : `${dateSchedules.length}건`}
                      </p>
                    </div>
                    {selectedKey === todayKey && (
                      <span className="text-[10px] font-bold tracking-widest text-blue-500 bg-blue-50 px-2.5 py-1 rounded-md">TODAY</span>
                    )}
                  </div>
                  {dateSchedules.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-slate-200 py-10 text-center">
                      <p className="text-slate-400 text-xs">이 날의 일정이 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dateSchedules.map(s => {
                        const linkedIdea = s.linkedIdeaId ? ideaGroups.find(g => g.id === s.linkedIdeaId) : null
                        const isWork = s.type === '업무 일정'
                        return (
                          <div key={s.id} className={`bg-white rounded-lg border border-slate-100 border-l-[3px] px-3.5 py-2.5 hover:shadow-sm transition-all group ${
                            isWork ? 'border-l-blue-400' : 'border-l-amber-400'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                                  isWork ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                                }`}>{s.category}</span>
                                {s.time && <span className="text-xs text-slate-400 font-mono shrink-0">{s.time}</span>}
                                {linkedIdea && (
                                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                                    💡 {linkedIdea.stockName}
                                  </span>
                                )}
                              </div>
                              <button onClick={() => deleteSchedule(s.id)}
                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all p-0.5 rounded shrink-0">
                                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">
                                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                              </button>
                            </div>
                            {s.memo && <p className="text-sm text-slate-700 mt-1 leading-snug">{s.memo}</p>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
