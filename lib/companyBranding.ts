export const COMPANY_BRANDING_BUCKET='carez-branding';
export const COMPANY_LOGO_MAX_BYTES=5*1024*1024;
export const COMPANY_LOGO_ACCEPT='image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
export const COMPANY_BRANDING_CHANGED_EVENT='carez-company-branding-changed';

export function companyLogoPublicUrl(supabase:any,logoPath:string|null|undefined){
  if(!logoPath)return null;
  return supabase.storage.from(COMPANY_BRANDING_BUCKET).getPublicUrl(logoPath).data.publicUrl||null;
}
