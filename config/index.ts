import { defineConfig } from '@tarojs/cli'

export default defineConfig({
  projectName: 'dorm-duty',
  date: '2026-10-27',
  designWidth: 750,
  deviceRatio: { 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
  sourceRoot: 'src',
  outputRoot: process.env.TARO_ENV === 'h5' ? 'dist' : 'dist/weapp',
  framework: 'react',
  compiler: 'webpack5',
  cache: { enable: false },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: { enable: false }
    }
  },
  h5: {
    publicPath: './',
    staticDirectory: 'static',
    router: { mode: 'hash' },
    postcss: {
      pxtransform: { enable: false },
      autoprefixer: { enable: true },
      cssModules: { enable: false }
    }
  }
})
