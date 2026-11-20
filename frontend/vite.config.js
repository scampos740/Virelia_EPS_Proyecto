import {defineConfig,loadEnv} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export default defineConfig(({mode})=>{
 const env={...loadEnv(mode,root,''),...process.env};
 return {esbuild:{jsx:"automatic"},envDir:root,server:{host:'127.0.0.1',port:5173,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${env.GATEWAY_PORT||3000}`,changeOrigin:false}}}};
});
