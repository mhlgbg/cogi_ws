export default {
  async index(ctx) {
    // user đã đăng nhập (do auth config ở route)
    const authUser = ctx.state.user
    if (!authUser?.id) {
      return ctx.unauthorized("Unauthorized")
    }

    // Lấy user đầy đủ + populate role (Strapi users-permissions)
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
        where: { id: authUser.id },
        populate: ["role"],
      })

    if (!user) return ctx.notFound("User not found")

    // Trả về dữ liệu gọn cho frontend
    ctx.body = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
        ? { id: user.role.id, name: user.role.name, type: user.role.type }
        : null,
      roleText: user.role?.name || "-",
    }
  },
}