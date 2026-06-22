const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; InvestingNote/1.0)' }

function toUnix(dateStr: string): number {
  return Math.floor(new Date(dateStr + 'T00:00:00+09:00').getTime() / 1000)
}

async function fetchChart(yahooTicker: string, period1: number, period2: number) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`
  console.log(`[Yahoo] ${yahooTicker}`)

  const resp = await fetch(url, { headers: HEADERS })
  if (!resp.ok) return null

  const json = await resp.json()
  return json?.chart?.result?.[0] || null
}

export const handler = async (event: any) => {
  const { ticker: rawTicker, market, openDate, closeDate } = event.arguments
  if (!rawTicker || !openDate) throw new Error('ticker와 openDate는 필수입니다')
  const ticker = rawTicker.replace(/\.(KS|KQ)$/, '')

  const period1 = toUnix(openDate) - 7 * 86400
  const period2 = closeDate ? toUnix(closeDate) + 86400 : Math.floor(Date.now() / 1000) + 86400
  const suffixes = market === 'KOSDAQ' ? ['.KQ', '.KS'] : ['.KS', '.KQ']

  let chartData: any = null
  for (const suffix of suffixes) {
    chartData = await fetchChart(ticker + suffix, period1, period2)
    if (chartData) break
  }

  if (!chartData) throw new Error(`${ticker} 데이터를 찾을 수 없습니다`)

  const timestamps: number[] = chartData.timestamp || []
  const closes: (number | null)[] = chartData.indicators?.quote?.[0]?.close || []
  const openDateUnix = toUnix(openDate)

  let openPrice: number | null = null
  let currentPrice: number | null = null
  const priceHistory: number[] = []

  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] <= openDateUnix + 86400 && closes[i] != null) openPrice = closes[i]!
  }
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] >= openDateUnix - 86400 && closes[i] != null) priceHistory.push(Math.round(closes[i]! * 100) / 100)
  }

  if (closeDate) {
    const closeDateUnix = toUnix(closeDate)
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] <= closeDateUnix + 86400 && closes[i] != null) currentPrice = closes[i]!
    }
  } else {
    currentPrice = chartData.meta?.regularMarketPrice ?? null
    if (!currentPrice && priceHistory.length > 0) currentPrice = priceHistory[priceHistory.length - 1]
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  if (!closeDate && openDate === todayStr && currentPrice) {
    openPrice = currentPrice
    if (priceHistory.length === 0) priceHistory.push(currentPrice)
  }

  if (openPrice === null && currentPrice != null) openPrice = currentPrice
  if (currentPrice === null && priceHistory.length > 0) currentPrice = priceHistory[priceHistory.length - 1]
  if (priceHistory.length === 0 && currentPrice != null) priceHistory.push(currentPrice)

  return { openPrice, currentPrice, priceHistory: JSON.stringify(priceHistory) }
}
