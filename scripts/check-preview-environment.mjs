// Issue #76 must be reviewed against the isolated QA database, never production.
// This guard applies only to the explicitly authorized rewrite preview branch.
const rewritePreview = process.env.VERCEL_ENV === 'preview'
  && process.env.VERCEL_GIT_COMMIT_REF === 'astra/complete-ui-rewrite';

if (rewritePreview && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://tkcirsdfvvahwrcratkn.supabase.co') {
  console.error('Rewrite preview requires the Carez QA Supabase branch overrides in Vercel.');
  process.exit(1);
}
