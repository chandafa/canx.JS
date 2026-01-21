
import { Command } from '../Command';
import { clear } from 'console';

export class DashboardCommand implements Command {
  signature = 'studio';
  description = 'Launch the CanxJS Studio Dashboard (TUI)';

  async handle(): Promise<void> {
    const port = process.env.PORT || 3000;
    const baseUrl = `http://localhost:${port}/devtools`;

    console.log('Connecting to CanxJS Studio API...');

    const refresh = async () => {
      try {
        const [routesRes, statsRes, modulesRes] = await Promise.all([
          fetch(`${baseUrl}/routes`).catch(() => null),
          fetch(`${baseUrl}/stats`).catch(() => null),
          fetch(`${baseUrl}/modules`).catch(() => null),
        ]);

        if (!routesRes || !statsRes || !modulesRes || !routesRes.ok) {
           throw new Error('Could not connect to application.');
        }

        const routes = await routesRes.json();
        const stats = await statsRes.json();
        const modules = await modulesRes.json();

        // TUI Render
        console.clear();
        console.log('\x1b[36m%s\x1b[0m', `
   ______                 __      _______
  / ____/___ _____  _  __/ /____ / ___/ /___  ______/ /(_)___ 
 / /   / __ \`/ __ \\| |/_/ // /_ \\__ \\/ __/ / / / __  / / __ \\
/ /___/ /_/ / / / />  </ __<  ___/ / /_/ /_/ / /_/ / / /_/ /
\\____/\\__,_/_/ /_/_/|_/_/  |_/____/\\__/\\__,_/\\__,_/_/\\____/                                                          
        `);
        console.log(`\x1b[32m● Online\x1b[0m | Uptime: ${stats.uptime.toFixed(0)}s | Memory: ${(stats.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log('----------------------------------------------------');
        
        console.log(`\x1b[33m[Modules]\x1b[0m Loaded: ${modules.count} | Global Providers: ${modules.globalProviders}`);
        console.log(`\x1b[33m[Routes]\x1b[0m  Total: ${routes.length}`);
        
        console.table(routes.map((r: any) => ({
            Method: r.method,
            Path: r.path,
            Handler: r.handler
        })));

        console.log('\x1b[90mPress Ctrl+C to exit studio\x1b[0m');

      } catch (err) {
        console.clear();
        console.log('\x1b[31m[CanxJS Studio] Disconnected\x1b[0m');
        console.log(`Waiting for application on port ${port}...`);
      }
    };

    // Initial run
    await refresh();
    
    // Loop
    setInterval(refresh, 2000);
    
    // Keep process alive
    await new Promise(() => {});
  }
}
