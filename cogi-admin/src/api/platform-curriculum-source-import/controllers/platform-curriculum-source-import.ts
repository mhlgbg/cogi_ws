export default {
  async preview(ctx: any) {
    const service = strapi.service('api::platform-curriculum-source-import.platform-curriculum-source-import') as any
    const result = await service.preview(ctx)
    ctx.body = result
  },

  async confirm(ctx: any) {
    const service = strapi.service('api::platform-curriculum-source-import.platform-curriculum-source-import') as any
    const result = await service.confirm(ctx)
    ctx.body = result
  },

  async listBatches(ctx: any) {
    const service = strapi.service('api::platform-curriculum-source-import.platform-curriculum-source-import') as any
    const result = await service.listBatches(ctx)
    ctx.body = result
  },

  async batchDetail(ctx: any) {
    const service = strapi.service('api::platform-curriculum-source-import.platform-curriculum-source-import') as any
    const result = await service.batchDetail(ctx)
    ctx.body = result
  },
}
