import { authResponse, sessionResponse, type LoginRequest, type RegisterRequest } from '../contracts'
import { http, parse, type RequestOptions } from '../http'

export const authApi = {
  login: async (body: LoginRequest) => parse(authResponse, (await http.post('/auth/login', body)).data),
  register: async (body: RegisterRequest) => parse(authResponse, (await http.post('/auth/register', body)).data),
  session: async ({ signal }: RequestOptions = {}) => parse(sessionResponse, (await http.get('/auth/session', { signal })).data),
  logout: async () => {
    await http.post('/auth/logout')
  },
}
