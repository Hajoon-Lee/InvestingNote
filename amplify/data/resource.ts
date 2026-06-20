import { a, defineData, type ClientSchema } from '@aws-amplify/backend'

const schema = a.schema({
  Todo: a
    .model({
      date: a.string().required(),
      text: a.string().required(),
      done: a.boolean().required(),
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
