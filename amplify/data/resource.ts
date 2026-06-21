import { a, defineData, type ClientSchema } from '@aws-amplify/backend'

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
    })
    .authorization(allow => [allow.publicApiKey()]),

  InvestmentIdeaGroup: a
    .model({
      stockName: a.string().required(),
      ticker: a.string().required(),
      position: a.string().required(),
      status: a.string().required(),
      openDate: a.string().required(),
      closeDate: a.string(),
    })
    .authorization(allow => [allow.publicApiKey()]),

  InvestmentMemo: a
    .model({
      ideaGroupId: a.string().required(),
      ticker: a.string().required(),
      memoType: a.string().required(),
      thesis: a.string().required(),
      risk: a.string().required(),
    })
    .authorization(allow => [allow.publicApiKey()]),
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
})
