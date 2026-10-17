'use client';

import {FluentProvider,SSRProvider,webLightTheme,type Theme} from '@fluentui/react-components';

/** CSS owns the palette; Fluent consumes the same semantic tokens. */
const pourTraceTheme:Theme={
  ...webLightTheme,
  fontFamilyBase:'var(--pourtrace-ui-font)',
  borderRadiusSmall:'6px',borderRadiusMedium:'8px',borderRadiusLarge:'10px',
  colorBrandBackground:'var(--pt-brand)',colorBrandBackgroundHover:'var(--pt-brand-hover)',
  colorBrandBackgroundPressed:'var(--pt-brand-pressed)',colorBrandBackgroundSelected:'var(--pt-brand)',
  colorCompoundBrandBackground:'var(--pt-brand)',colorCompoundBrandBackgroundHover:'var(--pt-brand-hover)',
  colorCompoundBrandBackgroundPressed:'var(--pt-brand-pressed)',colorNeutralForegroundOnBrand:'#FFFFFF',
  colorNeutralBackground1:'var(--pt-surface-1)',colorNeutralBackground2:'var(--pt-surface-2)',
  colorNeutralBackground3:'var(--pt-surface-3)',colorNeutralBackground4:'var(--pt-surface-3)',
  colorNeutralForeground1:'var(--pt-text)',colorNeutralForeground2:'var(--pt-text-secondary)',
  colorNeutralForeground3:'var(--pt-text-muted)',colorNeutralForeground4:'var(--pt-text-muted)',
  colorNeutralStroke1:'var(--pt-line)',colorNeutralStroke2:'var(--pt-line)',
  colorNeutralStrokeAccessible:'var(--pt-line-strong)',
  colorBrandForeground1:'var(--pt-brand)',colorBrandForeground2:'var(--pt-brand)',
  colorBrandForegroundLink:'var(--pt-brand)',colorBrandForegroundLinkHover:'var(--pt-brand-hover)',
  colorBrandForegroundLinkPressed:'var(--pt-brand-pressed)',
  colorBrandStroke1:'var(--pt-brand)',colorBrandStroke2:'var(--pt-line-strong)',
  colorCompoundBrandStroke:'var(--pt-brand)',colorCompoundBrandStrokeHover:'var(--pt-brand-hover)',
  colorCompoundBrandStrokePressed:'var(--pt-brand-pressed)',
  colorCompoundBrandForeground1:'var(--pt-brand)',colorCompoundBrandForeground1Hover:'var(--pt-brand-hover)',
  colorCompoundBrandForeground1Pressed:'var(--pt-brand-pressed)',
  colorBrandBackground2:'var(--selection-fill)',colorBrandBackground2Hover:'var(--pt-surface-hover)',
};

export function CarezAppearanceProvider({children}:{children:React.ReactNode}){
  return <SSRProvider><FluentProvider theme={pourTraceTheme} className="carez-fluent-root">{children}</FluentProvider></SSRProvider>;
}
