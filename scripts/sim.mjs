import { createServer } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({
    configFile: false,
    root,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'error',
});

try {
    const mod = await server.ssrLoadModule('/scripts/personality-sim.ts');
    mod.main(process.argv.slice(2));
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await server.close();
}
