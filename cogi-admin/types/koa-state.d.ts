export {}

declare module 'koa' {
  interface DefaultState {
    user?: {
      id?: number | string
      isPlatformAdmin?: boolean
      [key: string]: unknown
    }
  }
}