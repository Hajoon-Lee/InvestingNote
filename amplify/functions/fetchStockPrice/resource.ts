import { defineFunction } from '@aws-amplify/backend'

export const fetchStockPrice = defineFunction({
  name: 'fetchStockPrice',
  timeoutSeconds: 15,
})
