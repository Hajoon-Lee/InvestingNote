import { generateClient } from 'aws-amplify/data'

let client = null

function getClient() {
  if (!client) client = generateClient()
  return client
}

export const priceService = {
  async getIdeaPriceData(ticker, market, openDate, closeDate) {
    if (!ticker || !openDate) {
      console.warn('[priceService] Missing ticker or openDate:', { ticker, openDate })
      return { openPrice: null, currentPrice: null, priceHistory: [] }
    }

    console.log(`[priceService] Fetching: ticker=${ticker}, market=${market || 'auto'}, openDate=${openDate}, closeDate=${closeDate || 'none'}`)

    try {
      const response = await getClient().queries.fetchStockPrice({
        ticker,
        market: market || undefined,
        openDate,
        closeDate: closeDate || undefined,
      })

      if (response.errors?.length) {
        console.error(`[priceService] ❌ GraphQL errors for ${ticker}:`, response.errors.map(e => e.message))
        return { openPrice: null, currentPrice: null, priceHistory: [] }
      }

      const { data } = response
      const result = {
        openPrice: data?.openPrice ?? null,
        currentPrice: data?.currentPrice ?? null,
        priceHistory: data?.priceHistory ? JSON.parse(data.priceHistory) : [],
      }

      console.log(`[priceService] ${ticker} result:`, {
        openPrice: result.openPrice,
        currentPrice: result.currentPrice,
        historyLength: result.priceHistory.length,
      })

      return result
    } catch (error) {
      console.error(`[priceService] ❌ ${ticker} exception:`, error?.message || error)
      return { openPrice: null, currentPrice: null, priceHistory: [] }
    }
  },
}
