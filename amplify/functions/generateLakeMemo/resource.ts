import { defineFunction, secret } from '@aws-amplify/backend'

export const generateLakeMemo = defineFunction({
  name: 'generateLakeMemo',
  environment: {
    GEMINI_API_KEY: secret('GEMINI_API_KEY'),
  },
  timeoutSeconds: 60,
})
