import { defineAuth, secret } from '@aws-amplify/backend'

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: {
          email: 'email',
          fullname: 'name',
        },
      },
      callbackUrls: ['http://localhost:5173/', 'https://main.d30nxvxs21dtee.amplifyapp.com/'],
      logoutUrls: ['http://localhost:5173/', 'https://main.d30nxvxs21dtee.amplifyapp.com/'],
    },
  },
})
