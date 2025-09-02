import { createTheme, rem } from '@mantine/core';

export const theme = createTheme({
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen',
  headings: { fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen' },
  primaryColor: 'indigo',
  defaultRadius: 'md',
  components: {
    Button: {
      styles: {
        root: {
          fontWeight: 600
        }
      }
    }
  },
  spacing: { xs: rem(8), sm: rem(12), md: rem(16), lg: rem(24), xl: rem(32) }
});
