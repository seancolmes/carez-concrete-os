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

const pourTraceBrandTokens={
  colorBrandBackground:'#E97832',
  colorBrandBackgroundHover:'#F38A45',
  colorBrandBackgroundPressed:'#C86021',
  colorBrandBackgroundSelected:'#C86021',
  colorBrandBackgroundStatic:'#E97832',
  colorCompoundBrandBackground:'#E97832',
  colorCompoundBrandBackgroundHover:'#F38A45',
  colorCompoundBrandBackgroundPressed:'#C86021',
  colorBrandStroke1:'#E97832',
  colorCompoundBrandStroke:'#E97832',
  colorCompoundBrandStrokeHover:'#F38A45',
  colorCompoundBrandStrokePressed:'#C86021',
  colorNeutralForegroundOnBrand:'#111416',
};

const carezDarkTheme:Theme={
  ...webDarkTheme,
  ...pourTraceBrandTokens,
  colorNeutralBackground1:'#111416',
  colorNeutralBackground2:'#171B1E',
  colorNeutralBackground3:'#1D2327',
  colorNeutralBackground4:'#23282C',
  colorNeutralBackground5:'#23282C',
  colorNeutralBackground6:'#23282C',
  colorNeutralBackground7:'#23282C',
  colorNeutralBackground8:'#23282C',
  colorNeutralForeground1:'#F2F0EA',
  colorNeutralForeground2:'#A8ADB0',
  colorNeutralForeground3:'#747C80',
  colorNeutralForeground4:'#747C80',
  colorNeutralForeground5:'#747C80',
  colorNeutralForegroundDisabled:'#747C80',
  colorNeutralStroke1:'#343A3E',
  colorNeutralStroke2:'#343A3E',
  colorNeutralStroke3:'#4A5358',
  colorNeutralStroke4:'#4A5358',
  colorNeutralStrokeSubtle:'#343A3E',
  colorBrandForeground1:'#E97832',
  colorBrandForeground2:'#F38A45',
  colorBrandForegroundLink:'#F38A45',
  colorBrandForegroundLinkHover:'#FFA467',
  colorBrandForegroundLinkPressed:'#C86021',
  colorCompoundBrandForeground1:'#E97832',
  colorCompoundBrandForeground1Hover:'#F38A45',
  colorCompoundBrandForeground1Pressed:'#C86021',
  colorNeutralForeground2BrandHover:'#E97832',
  colorNeutralForeground3BrandHover:'#E97832',
  colorBrandBackground2:'#39291F',
  colorBrandBackground2Hover:'#4A3123',
  colorBrandStroke2:'#7D421F',
  colorPaletteBlueForeground2:'#A4BFCC',
  colorPaletteGreenBackground1:'#24343D',
  colorPaletteGreenBackground2:'#344A56',
  colorPaletteGreenBackground3:'#647D8A',
  colorPaletteGreenForeground1:'#A4BFCC',
  colorPaletteGreenForeground2:'#DCE5E9',
  colorPaletteGreenForeground3:'#A4BFCC',
  colorPaletteGreenForegroundInverted:'#466C7E',
  colorPaletteGreenBorderActive:'#8FA9B5',
  colorPaletteGreenBorder1:'#4A6370',
  colorPaletteGreenBorder2:'#8FA9B5',
  colorPaletteYellowForeground1:'#D3BE9C',
  colorPaletteRedForeground1:'#D96A6A',
};

const carezLightTheme:Theme={
  ...webLightTheme,
  ...pourTraceBrandTokens,
  colorNeutralBackground1:'#FFFFFF',
  colorNeutralBackground2:'#F2F0EA',
  colorNeutralBackground3:'#E9E8E3',
  colorNeutralForeground1:'#111416',
  colorNeutralForeground2:'#4B565B',
  colorNeutralForeground3:'#657075',
  colorNeutralStroke1:'#C9CECF',
  colorNeutralStroke2:'#DEE1E1',
  colorBrandForeground1:'#A7440C',
  colorBrandForeground2:'#913A09',
  colorBrandForegroundLink:'#A7440C',
  colorBrandForegroundLinkHover:'#913A09',
  colorBrandForegroundLinkPressed:'#773007',
  colorCompoundBrandForeground1:'#A7440C',
  colorCompoundBrandForeground1Hover:'#913A09',
  colorCompoundBrandForeground1Pressed:'#773007',
  colorNeutralForeground2BrandHover:'#A7440C',
  colorNeutralForeground3BrandHover:'#A7440C',
  colorBrandBackground2:'#FBE8DA',
  colorBrandBackground2Hover:'#F7D9C4',
  colorBrandStroke2:'#E7AD87',
  colorPaletteGreenBackground1:'#E7EEF1',
  colorPaletteGreenBackground2:'#C5D5DC',
  colorPaletteGreenBackground3:'#466C7E',
  colorPaletteGreenForeground1:'#466C7E',
  colorPaletteGreenForeground2:'#345466',
  colorPaletteGreenForeground3:'#466C7E',
  colorPaletteGreenForegroundInverted:'#A4BFCC',
  colorPaletteGreenBorderActive:'#466C7E',
  colorPaletteGreenBorder1:'#B1C5CE',
  colorPaletteGreenBorder2:'#466C7E',
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
    <FluentProvider theme={resolvedTheme==='dark'?carezDarkTheme:carezLightTheme} className="carez-fluent-root">
      {children}
    </FluentProvider>
  </AppearanceContext.Provider>;
}
