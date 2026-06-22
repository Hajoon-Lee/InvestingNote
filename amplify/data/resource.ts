import { a, defineData, type ClientSchema } from '@aws-amplify/backend'
import { generateLakeMemo } from '../functions/generateLakeMemo/resource'
import { fetchStockPrice } from '../functions/fetchStockPrice/resource'
import { fetchStockMaster } from '../functions/fetchStockMaster/resource'

const schema = a.schema({
  Schedule: a
    .model({
      type: a.string().required(),
      category: a.string().required(),
      date: a.string().required(),
      endDate: a.string(),
      time: a.string(),
      memo: a.string(),
      linkedIdeaId: a.string(),
      isRecurring: a.boolean(),
      recurrenceRule: a.string(),
      parentScheduleId: a.string(),
    })
    .authorization(allow => [allow.owner()]),

  InvestmentIdeaGroup: a
    .model({
      stockName: a.string().required(),
      ticker: a.string().required(),
      market: a.string(),
      position: a.string().required(),
      status: a.string().required(),
      openDate: a.string().required(),
      closeDate: a.string(),
    })
    .authorization(allow => [allow.owner()]),

  InvestmentMemo: a
    .model({
      ideaGroupId: a.string().required(),
      ticker: a.string().required(),
      memoType: a.string().required(),
      thesis: a.string().required(),
      risk: a.string().required(),
    })
    .authorization(allow => [allow.owner()]),

  LakeMemo: a
    .model({
      title: a.string().required(),
      summary: a.string().required(),
      keyPoints: a.string().required(),
    })
    .authorization(allow => [allow.owner()]),

  GeneratedMemo: a.customType({
    title: a.string(),
    summary: a.string(),
    keyPoints: a.string(),
  }),

  StockPriceResult: a.customType({
    openPrice: a.float(),
    currentPrice: a.float(),
    priceHistory: a.string(),
  }),

  generateLakeMemo: a
    .mutation()
    .arguments({
      text: a.string().required(),
      imageBase64: a.string(),
      imageMimeType: a.string(),
    })
    .returns(a.ref('GeneratedMemo'))
    .handler(a.handler.function(generateLakeMemo))
    .authorization(allow => [allow.authenticated()]),

  fetchStockPrice: a
    .query()
    .arguments({
      ticker: a.string().required(),
      market: a.string(),
      openDate: a.string().required(),
      closeDate: a.string(),
    })
    .returns(a.ref('StockPriceResult'))
    .handler(a.handler.function(fetchStockPrice))
    .authorization(allow => [allow.authenticated()]),

  searchStocks: a
    .query()
    .arguments({ query: a.string().required() })
    .returns(a.string())
    .handler(a.handler.function(fetchStockMaster))
    .authorization(allow => [allow.authenticated()]),
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
})
