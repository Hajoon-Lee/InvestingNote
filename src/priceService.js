// ── Price Service 추상화 레이어 ──
// 현재: mockPriceService (가상 데이터)
// 향후: KiwoomPriceService 또는 Backend API로 교체
//
// 교체 시:
//   import { kiwoomPriceService } from './kiwoomPriceService'
//   export const priceService = kiwoomPriceService

const MOCK_PRICES = {
  '005930.KS': { base: 72000, current: 78500 },
  '000660.KS': { base: 185000, current: 210000 },
  '035420.KS': { base: 195000, current: 205000 },
  '035720.KS': { base: 52000, current: 48500 },
  'NVDA': { base: 120, current: 145 },
  'TSLA': { base: 250, current: 280 },
  'MSFT': { base: 420, current: 450 },
  'AAPL': { base: 190, current: 205 },
}

const hashCode = (s) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const seededRand = (seed) => {
  let s = seed || 1
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
}

const mockPriceService = {
  async getClosePriceOnOrBeforeDate(ticker, date) {
    const mp = MOCK_PRICES[ticker]
    if (!mp || !date) return null
    const rand = seededRand(hashCode(ticker + date))
    return Math.round(mp.base * (0.92 + rand() * 0.22))
  },

  async getLatestClosePrice(ticker) {
    const mp = MOCK_PRICES[ticker]
    return mp ? mp.current : null
  },

  async getPriceHistory(ticker, startDate, endDate) {
    const mp = MOCK_PRICES[ticker]
    if (!mp) return []
    const rand = seededRand(hashCode(ticker + startDate))
    const totalDays = Math.max(1, Math.floor(
      ((endDate ? new Date(endDate) : new Date()) - new Date(startDate)) / 86400000
    ))
    const prices = []
    let price = mp.base
    for (let i = 0; i <= totalDays; i++) {
      prices.push(Math.round(price))
      price *= 1 + (rand() - 0.48) * 0.03
    }
    if (!endDate) prices[prices.length - 1] = mp.current
    return prices
  },
}

export const priceService = mockPriceService
