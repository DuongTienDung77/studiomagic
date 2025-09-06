import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.AIzaSyCnIlyGlLsQuiQH_rq3MvtmrN2xhZDfM8U),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.AIzaSyCnIlyGlLsQuiQH_rq3MvtmrN2xhZDfM8U)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
