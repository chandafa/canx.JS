import { CanxException } from './exceptions/CanxException';

export class ErrorHandler {
  /**
   * Handle an error and return a formatted Response
   */
  static async handle(error: Error | CanxException, req: Request, isDev: boolean = false): Promise<Response> {
    const status = (error as CanxException).status || 500;
    const message = error.message || 'Internal Server Error';
    const code = (error as CanxException).code || 'INTERNAL_ERROR';
    const stack = error.stack || '';

    // Log to console with nice formatting
    this.logError(error, req);

    // Return JSON for API requests or Production
    if (!isDev || req.headers.get('accept') === 'application/json') {
      return new Response(JSON.stringify({
        error: {
          message,
          code,
          status,
          ...(isDev ? { stack: stack.split('\n') } : {})
        }
      }), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return Beautiful HTML Error Page for Browser in Dev
    const html = await this.renderErrorPage(error, req, status, code, stack);
    return new Response(html, {
      status,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  /**
   * Log error to console with ANSI colors
   */
  private static logError(error: Error | CanxException, req: Request) {
    const status = (error as CanxException).status || 500;
    const color = status >= 500 ? '\x1b[31m' : '\x1b[33m'; // Red for 500, Yellow for 400
    const reset = '\x1b[0m';

    console.error(`
${color}╔════ ERROR ${status} ═════════════════════════════════════════════════╗${reset}
║ ${req.method} ${req.url}
║ ${color}${error.message}${reset}
╚══════════════════════════════════════════════════════════════════╝
${error.stack?.split('\n').filter(l => !l.includes('node_modules')).join('\n')}
    `);
  }

  /**
   * Render HTML Error Page
   */
  private static async renderErrorPage(
    error: Error | CanxException, 
    req: Request, 
    status: number, 
    code: string, 
    stack: string
  ): Promise<string> {
    // Attempt to extract file context
    const fileContext = await this.getFileContext(stack);

    return `
      <!DOCTYPE html>
      <html lang="en" class="dark">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error ${status}: ${error.message}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          .code-line { counter-increment: line; }
          .code-line::before { 
            content: counter(line); 
            display: inline-block; 
            width: 30px; 
            color: #6b7280; 
            text-align: right; 
            margin-right: 15px; 
            font-size: 0.8em;
          }
          .highlight { background-color: rgba(220, 38, 38, 0.2); border-left: 2px solid #dc2626; }
        </style>
      </head>
      <body class="bg-[#0f1117] text-gray-300 font-sans min-h-screen p-8">
        <div class="max-w-6xl mx-auto space-y-8">
          
          <!-- Header -->
          <div class="bg-[#1e293b] border border-red-900/30 rounded-xl p-6 shadow-2xl relative overflow-hidden">
             <div class="absolute top-0 left-0 w-2 h-full bg-red-600"></div>
             <div class="flex items-start justify-between">
                <div>
                   <div class="flex items-center gap-3 mb-2">
                      <span class="bg-red-500/20 text-red-400 px-3 py-1 rounded text-sm font-mono font-bold">
                        ${status} ${code}
                      </span>
                      <span class="text-gray-500 font-mono text-sm">${req.method} ${new URL(req.url).pathname}</span>
                   </div>
                   <h1 class="text-3xl font-bold text-white mb-2 break-all">${error.message}</h1>
                   <p class="text-gray-400 font-mono text-sm break-all opacity-80">${error.name}</p>
                </div>
             </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
             
             <!-- Left: Stack Trace & Code -->
             <div class="lg:col-span-2 space-y-8">
                
                ${fileContext ? `
                <!-- Code Snippet -->
                <div class="bg-[#1e293b] rounded-xl overflow-hidden border border-gray-800 shadow-xl">
                   <div class="bg-[#0f1117] px-4 py-2 border-b border-gray-800 flex justify-between items-center">
                      <div class="font-mono text-xs text-gray-400 truncate max-w-lg">
                         ${fileContext.file}
                      </div>
                      <div class="text-xs text-gray-500">Line ${fileContext.line}</div>
                   </div>
                   <div class="p-4 overflow-x-auto bg-[#0f1117]">
                      <pre class="font-mono text-sm leading-6" style="counter-reset: line ${fileContext.startLine - 1};">
${fileContext.snippet}
                      </pre>
                   </div>
                </div>
                ` : ''}

                <!-- Stack Trace -->
                <div class="bg-[#1e293b] rounded-xl border border-gray-800 shadow-xl p-6">
                   <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                      Stack Trace
                   </h2>
                   <div class="space-y-3 font-mono text-sm">
                      ${stack.split('\n').slice(1).map(line => {
                        const isAppCode = !line.includes('node_modules');
                        return `
                        <div class="p-2 rounded ${isAppCode ? 'bg-blue-500/10 border-l-2 border-blue-500' : 'text-gray-500 pl-4'} break-all hover:bg-white/5 transition-colors">
                           ${line.trim().replace(/^at /, '<span class="text-gray-600 mr-2">at</span>')}
                        </div>
                        `;
                      }).join('')}
                   </div>
                </div>

             </div>

             <!-- Right: Context -->
             <div class="space-y-8">
                
                <!-- Request Info -->
                <div class="bg-[#1e293b] rounded-xl border border-gray-800 shadow-xl p-6">
                   <h2 class="text-lg font-semibold text-white mb-4">Request Data</h2>
                   
                   <div class="space-y-4">
                      <div>
                         <h3 class="text-xs uppercase text-gray-500 font-bold mb-2">Headers</h3>
                         <div class="bg-[#0f1117] rounded p-3 text-xs font-mono space-y-1 overflow-x-auto">
                            ${(Array.from(req.headers as any) as [string, string][]).map(([k, v]) => `
                              <div class="flex gap-2">
                                <span class="text-blue-400 min-w-[100px]">${k}:</span>
                                <span class="text-gray-400 truncate">${v}</span>
                              </div>
                            `).join('')}
                         </div>
                      </div>
                      
                      <div>
                         <h3 class="text-xs uppercase text-gray-500 font-bold mb-2">Query Parameters</h3>
                         <div class="bg-[#0f1117] rounded p-3 text-xs font-mono text-gray-400">
                            ${JSON.stringify(Object.fromEntries(new URL(req.url).searchParams), null, 2)}
                         </div>
                      </div>
                   </div>
                </div>

                <!-- Environment -->
                <div class="bg-[#1e293b] rounded-xl border border-gray-800 shadow-xl p-6">
                   <h2 class="text-lg font-semibold text-white mb-4">Environment</h2>
                   <div class="grid grid-cols-2 gap-4 text-sm">
                      <div>
                         <div class="text-gray-500 text-xs uppercase mb-1">Runtime</div>
                         <div class="text-white flex items-center gap-2">
                           <span class="w-2 h-2 rounded-full bg-green-400"></span>
                           Bun ${Bun.version}
                         </div>
                      </div>
                      <div>
                         <div class="text-gray-500 text-xs uppercase mb-1">Environment</div>
                         <div class="text-white">development</div>
                      </div>
                   </div>
                </div>

             </div>
          </div>

        </div>
      </body>
      </html>
    `;
  }

  /**
   * Helper to extract code snippet from stack trace
   */
  private static async getFileContext(stack: string): Promise<{ file: string, line: number, snippet: string, startLine: number } | null> {
    try {
      const match = stack.match(/at .+ \((.+):(\d+):(\d+)\)/) || stack.match(/at (.+):(\d+):(\d+)/);
      if (!match) return null;

      const [_, file, lineStr] = match;
      const invalidExtensions = ['.node', '.json'];
      if(invalidExtensions.some(ext => file.endsWith(ext))) return null;

      const line = parseInt(lineStr);
      
      const fileContent = await Bun.file(file).text();
      const lines = fileContent.split('\n');
      
      const start = Math.max(0, line - 10);
      const end = Math.min(lines.length, line + 10);
      
      const snippet = lines.slice(start, end).map((l, i) => {
        const currentLine = start + i + 1;
        const isHighlight = currentLine === line;
        return `<div class="code-line ${isHighlight ? 'highlight' : ''}">${l}</div>`;
      }).join('');

      return { file, line, snippet, startLine: start + 1 };
    } catch {
      return null;
    }
  }
}
