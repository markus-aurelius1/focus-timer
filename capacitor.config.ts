import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.lodestar.study',
  appName: 'Lodestar',
  webDir: 'dist',
  backgroundColor: '#0a0c14',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_lodestar',
      iconColor: '#F2C46D',
    },
  },
}

export default config
