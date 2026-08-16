import TenantSettingsLayout from '../components/TenantSettingsLayout'
import TenantWebsiteSettingsForm from '../components/TenantWebsiteSettingsForm'

export default function TenantWebsiteSettingsPage() {
  return (
    <TenantSettingsLayout activeTab='website' pageTitle='Website' pageDescription='Quản lý tiêu đề, nhận diện, thông tin SEO và các hình ảnh mặc định của website tenant.'>
      <TenantWebsiteSettingsForm />
    </TenantSettingsLayout>
  )
}