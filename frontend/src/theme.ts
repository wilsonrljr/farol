import { createTheme, rem, MantineColorsTuple } from '@mantine/core';

const sand: MantineColorsTuple = [
  '#fbf7f0',
  '#f4eee2',
  '#eadfc8',
  '#ddcaa8',
  '#d2b58b',
  '#c9a775',
  '#c09b64',
  '#a98453',
  '#8e6d45',
  '#765b3a',
];

const moss: MantineColorsTuple = [
  '#f2f7f1',
  '#e5efe3',
  '#cce0ca',
  '#aecdaa',
  '#8eb58b',
  '#74a575',
  '#61985f',
  '#4f804f',
  '#416741',
  '#365537',
];

const ember: MantineColorsTuple = [
  '#fff4e7',
  '#ffe9cf',
  '#ffd2a8',
  '#ffb97f',
  '#ffa25b',
  '#ff9144',
  '#ff8636',
  '#e56e27',
  '#c35b20',
  '#9e4719',
];

export const theme = createTheme({
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen',
  headings: { fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen' },
  colors: {
    sand,
    moss,
    ember,
  },
  primaryColor: 'moss',
  primaryShade: { light: 7, dark: 6 },
  defaultRadius: 'md',
  spacing: { xs: rem(8), sm: rem(12), md: rem(16), lg: rem(24), xl: rem(32) },
  components: {
    Button: {
      styles: {
        root: {
          fontWeight: 650,
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'md',
        withBorder: true,
        shadow: 'sm',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
    },
  },
});
