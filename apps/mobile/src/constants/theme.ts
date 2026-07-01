export const Colors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#334155',
  border: '#334155',
  primary: '#6366F1',
  primaryLight: '#818CF8',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  white: '#FFFFFF',
} as const;

export const Fonts = {
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
} as const;

export const FontSize = {
  small: 12,
  caption: 13,
  body: 15,
  subheading: 18,
  heading: 24,
  display: 32,
} as const;

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
} as const;

export const Radii = {
  sm: 8, md: 12, button: 14, card: 16, full: 999,
} as const;
