const NAVER_AC = 'https://ac.stock.naver.com/ac'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  'Accept': 'application/json',
}

export const handler = async (event: any) => {
  const query = (event.arguments?.query || '').trim()
  if (!query) return JSON.stringify([])

  const url = `${NAVER_AC}?q=${encodeURIComponent(query)}&target=stock`
  console.log(`[searchStocks] 네이버 자동완성: "${query}" → ${url}`)

  const resp = await fetch(url, { headers: HEADERS })
  const rawText = await resp.text()
  console.log(`[searchStocks] status=${resp.status}, body=${rawText.slice(0, 500)}`)

  if (!resp.ok) throw new Error(`네이버 자동완성 실패 (${resp.status}): ${rawText.slice(0, 200)}`)

  let data: any
  try { data = JSON.parse(rawText) } catch {
    throw new Error(`JSON 파싱 실패: ${rawText.slice(0, 200)}`)
  }

  // 네이버 자동완성 응답 파싱 (여러 포맷 대응)
  let stocks: Array<{ name: string, ticker: string, market: string }> = []

  const items = data.items || data.result?.items || data.stocks || data.data || []
  console.log(`[searchStocks] items: ${items.length}개, keys: ${items[0] ? Object.keys(items[0]) : 'empty'}`)

  if (items.length > 0) {
    stocks = items
      .filter((item: any) => {
        const code = item.code || item.cd || item.stockCode || item.symbol || ''
        const name = item.name || item.nm || item.stockName || item.keyword || ''
        return code && name
      })
      .map((item: any) => {
        const code = (item.code || item.cd || item.stockCode || item.symbol || '').replace(/^A/, '')
        const name = item.name || item.nm || item.stockName || item.keyword || ''
        const market = (item.market || item.typeCode || item.mkt || '').includes('KOSDAQ') ? 'KOSDAQ' : 'KOSPI'
        return { name, ticker: code, market }
      })
  }

  console.log(`[searchStocks] ✅ 결과: ${stocks.length}개`)
  return JSON.stringify(stocks)
}
