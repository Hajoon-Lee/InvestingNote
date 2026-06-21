import { a, defineData, type ClientSchema } from '@aws-amplify/backend'
import { generateLakeMemo } from '../functions/generateLakeMemo/resource'

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
    .authorization(allow => [allow.owner()]),

  InvestmentIdeaGroup: a
    .model({
      stockName: a.string().required(),
      ticker: a.string().required(),
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

  generateLakeMemo: a
    .mutation()
    .arguments({ text: a.string().required() })
    .returns(a.ref('GeneratedMemo'))
    .handler(a.handler.function(generateLakeMemo))
    .authorization(allow => [allow.authenticated()]),
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
})
