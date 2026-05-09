import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.brazoutickets',
  appName: 'brazoutickets',
  webDir: 'dist',
  server: {
    url: 'https://0f6f784c-04ef-47cd-84c1-a8352c8954aa.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
