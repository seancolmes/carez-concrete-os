type ProviderRuntime={NODE_ENV?:string;VERCEL_ENV?:string};

export const PROVIDER_MUTATION_DENIED_MESSAGE='Provider sync is disabled in this environment.';

export function providerMutationAllowed(env:ProviderRuntime=process.env){
  return env.NODE_ENV==='production'&&env.VERCEL_ENV==='production';
}
