import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  colors: {
    ssv: {
      50: '#e3f3ff',
      100: '#b3dbff',
      200: '#80c2ff',
      300: '#4daaff',
      400: '#269aff',
      500: '#2D9CFF', // SSV Blue
      600: '#0077cc',
      700: '#005999',
      800: '#003b66',
      900: '#001d33',
    },
  },
  components: {
    Stack: {
      baseStyle: {
        spacing: '1rem',
      },
    },
    Button: {
      baseStyle: {
        fontWeight: 'bold',
      },
      variants: {
        solid: {
          bg: 'ssv.500',
          color: 'white',
          _hover: { bg: 'ssv.600' },
        },
      },
    },
  },
  styles: {
    global: {
      body: {
        bg: 'ssv.50',
        color: 'ssv.900',
      },
    },
  },
})

export default theme 