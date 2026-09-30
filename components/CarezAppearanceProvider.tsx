'use client';

import {FluentProvider,webDarkTheme,webLightTheme,type Theme} from '@fluentui/react-components';
import {createContext,useCallback,useContext,useEffect,useState} from 'react';
import {
  CAREZ_THEME_MEDIA_QUERY,
  CAREZ_THEME_STORAGE_KEY,
  normalizeThemePreference,
  resolveThemePreference,
  type CarezResolvedTheme,
  type CarezThemePreference,
} from '@/lib/ui/appearance';

type AppearanceContextValue = {
  ready:boolean;
  themePreference:CarezThemePreference;
  resolvedTheme:CarezResolvedTheme;
  setThemePreference:(preference:CarezThemePreference)=>void;
};

const AppearanceContext=createContext<AppearanceContextValue|null>(null);

const carezDarkTheme:Theme={
  ...webDarkTheme,
  colorNeutralBackground1:'#121212',
  colorNeutralBackground2:'#181A19',
  colorNeutralBackground3:'#202321',
  colorNeutralBackground4:'#202321',
  colorNeutralBackground5:'#202321',
  colorNeutralBackground6:'#202321',
  colorNeutralBackground7:'#202321',
  colorNeutralBackground8:'#202321',
  colorNeutralForeground1:'#F2F4F3',
  colorNeutralForeground2:'#B3BBB6',
  colorNeutralForeground3:'#7F8A84',
  colorNeutralForeground4:'#7F8A84',
  colorNeutralForeground5:'#7F8A84',
  colorNeutralForegroundDisabled:'#7F8A84',
  colorNeutralStroke1:'#2B302D',
  colorNeutralStroke2:'#2B302D',
  colorNeutralStroke3:'#2B302D',
  colorNeutralStroke4:'#2B302D',
  colorNeutralStrokeSubtle:'#2B302D',
  colorBrandBackground:'#5EA27A',
  colorBrandBackgroundHover:'#73B58D',
  colorBrandBackgroundPressed:'#4B8C65',
  colorBrandForeground1:'#5EA27A',
  colorNeutralForegroundOnBrand:'#121212',
  colorPaletteBlueForeground2:'#6C9FD8',
  colorPaletteYellowForeground1:'#E0A84B',
  colorPaletteRedForeground1:'#D96A6A',
};

export function useCarezAppearance(){
  const appearance=useContext(AppearanceContext);
  if(!appearance)throw new Error('useCarezAppearance must be used inside CarezAppearanceProvider');
  return appearance;
}

export function CarezAppearanceProvider({children}:{children:React.ReactNode}){
  const [ready,setReady]=useState(false);
  const [themePreference,setPreference]=useState<CarezThemePreference>('light');
  const [resolvedTheme,setResolvedTheme]=useState<CarezResolvedTheme>('light');

  const applyTheme=useCallback((preference:CarezThemePreference)=>{
    const resolved=resolveThemePreference(preference,window.matchMedia(CAREZ_THEME_MEDIA_QUERY).matches);
    const root=document.documentElement;
    root.dataset.themePreference=preference;
    root.dataset.theme=resolved;
    root.classList.toggle('dark',resolved==='dark');
    root.style.colorScheme=resolved;
    setPreference(preference);
    setResolvedTheme(resolved);
  },[]);

  useEffect(()=>{
    const root=document.documentElement;
    let stored:string|null=null;
    try{stored=window.localStorage.getItem(CAREZ_THEME_STORAGE_KEY);}catch{}
    applyTheme(normalizeThemePreference(root.dataset.themePreference??stored));
    setReady(true);

    const media=window.matchMedia(CAREZ_THEME_MEDIA_QUERY);
    const onMediaChange=()=>{
      if(root.dataset.themePreference==='system')applyTheme('system');
    };
    const onStorage=(event:StorageEvent)=>{
      if(event.key===CAREZ_THEME_STORAGE_KEY)applyTheme(normalizeThemePreference(event.newValue));
    };
    media.addEventListener('change',onMediaChange);
    window.addEventListener('storage',onStorage);
    return ()=>{
      media.removeEventListener('change',onMediaChange);
      window.removeEventListener('storage',onStorage);
    };
  },[applyTheme]);

  const setThemePreference=useCallback((preference:CarezThemePreference)=>{
    applyTheme(preference);
    try{window.localStorage.setItem(CAREZ_THEME_STORAGE_KEY,preference);}catch{}
  },[applyTheme]);

  return <AppearanceContext.Provider value={{ready,themePreference,resolvedTheme,setThemePreference}}>
    <FluentProvider theme={resolvedTheme==='dark'?carezDarkTheme:webLightTheme} className="carez-fluent-root">
      {children}
    </FluentProvider>
  </AppearanceContext.Provider>;
}
