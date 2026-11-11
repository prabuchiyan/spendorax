import { lightTheme, darkTheme } from '../context/ThemeContext';

export const Colors = {
  primary: '#4B7CF3',
  accent: '#FFB86B',
  background: '#F6F8FF',
  card: '#FFFFFF',
  text: '#1F2D3D',
  muted: '#7B8794',
};

export const LightColors = lightTheme;
export const DarkColors = darkTheme;

export const Spacing = {
  xs: 6,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
};

export { lightTheme, darkTheme };
export default { Colors, Spacing, LightColors, DarkColors, lightTheme, darkTheme };
