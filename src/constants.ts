// Constants for Pi-hole MCP server

export const PUBLIC_ENDPOINTS = [
  '/api/info/client',
  '/api/info/login'
] as const

export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE'
} as const

export type HttpMethod = typeof HTTP_METHODS[keyof typeof HTTP_METHODS]
