import { defineFunction } from '@aws-amplify/backend'

export const fetchStockMaster = defineFunction({
  name: 'fetchStockMaster',
  timeoutSeconds: 30,
  memoryMB: 256,
})
