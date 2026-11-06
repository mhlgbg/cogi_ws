import previewService from '../services/preview-service'
import confirmService from '../services/confirm-service'

export default {
  async preview(ctx) {
    return previewService.preview(ctx)
  },

  async getPreview(ctx) {
    return previewService.getPreview(ctx)
  },

  async confirm(ctx) {
    return confirmService.confirm(ctx)
  },

  async getBatchStatus(ctx) {
    return confirmService.getBatchStatus(ctx)
  },

  async listBatches(ctx) {
    return confirmService.listBatches(ctx)
  },
}
