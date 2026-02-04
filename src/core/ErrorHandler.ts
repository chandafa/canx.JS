import { CanxException } from './exceptions/CanxException';
import { NotFoundException } from './exceptions/NotFoundException';
import { ViewNotFoundException } from './exceptions/ViewNotFoundException';
import { ValidationException } from './exceptions/ValidationException';

interface ErrorPageConfig {
  title: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  suggestion?: string;
}

const ERROR_CONFIGS: Record<number, ErrorPageConfig> = {
  400: {
    title: 'Bad Request',
    icon: '⚠️',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    suggestion: 'Check your request data and try again.',
  },
  401: {
    title: 'Unauthorized',
    icon: '🔐',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    suggestion: 'Please login to access this resource.',
  },
  403: {
    title: 'Forbidden',
    icon: '🚫',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    suggestion: 'You do not have permission to access this resource.',
  },
  404: {
    title: 'Not Found',
    icon: '🔍',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    suggestion: 'The page or resource you are looking for does not exist.',
  },
  405: {
    title: 'Method Not Allowed',
    icon: '🚧',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    suggestion: 'This HTTP method is not supported for this route.',
  },
  409: {
    title: 'Conflict',
    icon: '⚡',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    suggestion: 'There is a conflict with the current state of the resource.',
  },
  422: {
    title: 'Validation Error',
    icon: '📝',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    suggestion: 'Please check your input and correct the validation errors.',
  },
  429: {
    title: 'Too Many Requests',
    icon: '⏱️',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    suggestion: 'You have made too many requests. Please wait and try again.',
  },
  500: {
    title: 'Internal Server Error',
    icon: '💥',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    suggestion: 'Something went wrong on our end. Please try again later.',
  },
  503: {
    title: 'Service Unavailable',
    icon: '🔧',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    suggestion: 'The service is temporarily unavailable. Please try again later.',
  },
};

export class ErrorHandler {
  /**
   * Handle an error and return a formatted Response
   */
  static async handle(error: Error | CanxException, req: Request, isDev: boolean = false): Promise<Response> {
    const status = (error as CanxException).status || 500;
    const message = error.message || 'Internal Server Error';
    const code = (error as CanxException).code || 'INTERNAL_ERROR';
    const stack = error.stack || '';
    const details = (error as CanxException).details;

    // Log to console with nice formatting
    this.logError(error, req);

    // Return JSON for API requests or Production
    if (!isDev || req.headers.get('accept') === 'application/json') {
      const responseBody: any = {
        error: {
          message,
          code,
          status,
        }
      };
      
      // Add validation errors if present
      if (error instanceof ValidationException && details) {
        responseBody.error.errors = details;
      }
      
      // Add stack trace in dev
      if (isDev) {
        responseBody.error.stack = stack.split('\n');
      }
      
      return new Response(JSON.stringify(responseBody), {
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
    const code = (error as CanxException).code || 'INTERNAL_ERROR';
    const color = status >= 500 ? '\x1b[31m' : '\x1b[33m'; // Red for 500, Yellow for 400
    const reset = '\x1b[0m';
    const cyan = '\x1b[36m';
    const dim = '\x1b[2m';

    console.error(`
${color}╔════════════════════════════════════════════════════════════════════╗${reset}
${color}║${reset}  ${this.getStatusEmoji(status)} ${color}ERROR ${status}${reset} - ${code}
${color}╟────────────────────────────────────────────────────────────────────╢${reset}
${color}║${reset}  ${cyan}${req.method}${reset} ${new URL(req.url).pathname}
${color}║${reset}  ${error.message}
${color}╚════════════════════════════════════════════════════════════════════╝${reset}
${dim}${error.stack?.split('\n').filter(l => !l.includes('node_modules')).slice(0, 5).join('\n')}${reset}
    `);
  }

  /**
   * Get emoji for status code
   */
  private static getStatusEmoji(status: number): string {
    const config = ERROR_CONFIGS[status];
    return config?.icon || '❌';
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
    const config = ERROR_CONFIGS[status] || ERROR_CONFIGS[500];
    const fileContext = await this.getFileContext(stack);
    const url = new URL(req.url);
    
    // Special handling for ViewNotFoundException
    const isViewError = error instanceof ViewNotFoundException;
    const viewInfo = isViewError ? {
      viewPath: (error as ViewNotFoundException).viewPath,
      searchedPaths: (error as ViewNotFoundException).searchedPaths,
    } : null;
    
    // Special handling for ValidationException
    const isValidationError = error instanceof ValidationException;
    const validationErrors = isValidationError ? (error as CanxException).details : null;

    // Special handling for React Hooks / JSX Runtime errors in View
    let specialSuggestion = config.suggestion;
    const errorStr = (error.message + (error.stack || '')).toLowerCase();
    
    if (errorStr.includes('invalid hook call') || errorStr.includes('usestate') || errorStr.includes('useeffect') || errorStr.includes('createcontext')) {
      specialSuggestion = `
        <span class="text-amber-400 font-bold">⚠️ Warning: React Hooks are not supported.</span><br>
        CanXJS Views are <strong>server-rendered (SSR)</strong> and static. they do not run in the browser.
        <ul class="list-disc list-inside mt-2 text-sm text-gray-400">
          <li>Do not use <code class="text-amber-300">useState</code>, <code class="text-amber-300">useEffect</code>, or other hooks.</li>
          <li>For interactivity, use <strong>Alpine.js</strong> (e.g., <code class="text-green-400">x-data</code>, <code class="text-green-400">@click</code>).</li>
          <li>Or use standard Vanilla JS with <code class="text-green-400">&lt;script&gt;</code> tags.</li>
        </ul>
      `;
    } else if (errorStr.includes('is not a function') && errorStr.includes(' map')) {
       specialSuggestion += ' <br><br>Tip: You might be trying to render an object causing a crash. Check if you are passing an array correctly.';
    }

    return `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.icon} ${status} - ${config.title}</title>
  <style>
    /* Reset & Base */
    :root {
      --bg-color: #0a0f1a;
      --text-color: #d1d5db;
      --glass-bg: rgba(30, 41, 59, 0.8);
      --glass-border: rgba(255, 255, 255, 0.1);
    }
    body { margin: 0; padding: 0; background-color: var(--bg-color); color: var(--text-color); font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; }
    *, *::before, *::after { box-sizing: border-box; }
    
    /* Utilities */
    .dark { color-scheme: dark; }
    .min-h-screen { min-height: 100vh; }
    .relative { position: relative; }
    .fixed { position: fixed; }
    .absolute { position: absolute; }
    .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
    .overflow-hidden { overflow: hidden; }
    .pointer-events-none { pointer-events: none; }
    .flex { display: flex; }
    .grid { display: grid; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-5 { padding: 1.25rem; }
    .p-6 { padding: 1.5rem; }
    .p-8 { padding: 2rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-6 { margin-top: 1.5rem; }
    .ml-2 { margin-left: 0.5rem; }
    .mr-2 { margin-right: 0.5rem; }
    .w-full { width: 100%; }
    .max-w-6xl { max-width: 72rem; }
    .max-w-md { max-width: 28rem; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .rounded { border-radius: 0.25rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .rounded-2xl { border-radius: 1rem; }
    .rounded-full { border-radius: 9999px; }
    .border { border-width: 1px; border-style: solid; border-color: var(--glass-border); }
    .border-b { border-bottom-width: 1px; border-bottom-style: solid; border-color: var(--glass-border); }
    .border-l-2 { border-left-width: 2px; border-left-style: solid; }
    .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
    .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
    
    /* Typography */
    .text-xs { font-size: 0.75rem; }
    .text-sm { font-size: 0.875rem; }
    .text-lg { font-size: 1.125rem; }
    .text-2xl { font-size: 1.5rem; }
    .text-3xl { font-size: 1.875rem; }
    .font-medium { font-weight: 500; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .uppercase { text-transform: uppercase; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .break-all { word-break: break-all; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    
    /* Colors */
    .bg-white { background-color: #ffffff; }
    .text-white { color: #ffffff; }
    .text-gray-300 { color: #d1d5db; }
    .text-gray-400 { color: #9ca3af; }
    .text-gray-500 { color: #6b7280; }
    .text-gray-600 { color: #4b5563; }
    
    /* Custom Components */
    .mono { font-family: monospace; }
    .code-line { counter-increment: line; }
    .code-line::before { 
      content: counter(line); 
      display: inline-block; 
      width: 40px; 
      color: #6b7280; 
      text-align: right; 
      margin-right: 20px; 
      font-size: 0.8em;
      user-select: none;
    }
    .highlight { 
      background: rgba(239,68,68,0.1); 
      border-left: 3px solid #ef4444; 
      margin-left: -3px;
    }
    .glass {
      background: var(--glass-bg);
      backdrop-filter: blur(10px);
    }
    .gradient-border {
      background: linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(236,72,153,0.3) 100%);
      padding: 1px;
      border-radius: 16px;
    }
    
    /* Colors mapping for dynamic classes */
    .text-yellow-400 { color: #facc15; }
    .bg-yellow-500\\/10 { background-color: rgba(234, 179, 8, 0.1); }
    .border-yellow-500\\/30 { border-color: rgba(234, 179, 8, 0.3); }
    
    .text-red-400 { color: #f87171; }
    .text-red-500 { color: #ef4444; }
    .bg-red-500\\/10 { background-color: rgba(239, 68, 68, 0.1); }
    .border-red-500\\/30 { border-color: rgba(239, 68, 68, 0.3); }
    
    .text-blue-400 { color: #60a5fa; }
    .bg-blue-500\\/5 { background-color: rgba(59, 130, 246, 0.05); }
    .bg-blue-500\\/10 { background-color: rgba(59, 130, 246, 0.1); }
    .border-blue-500\\/30 { border-color: rgba(59, 130, 246, 0.3); }
    
    .text-green-400 { color: #4ade80; }
    
    /* Responsive */
    @media (min-width: 1024px) {
      .lg\\:p-10 { padding: 2.5rem; }
      .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .lg\\:col-span-2 { grid-column: span 2 / span 2; }
    }
  </style>
</head>
<body class="bg-[#0a0f1a] text-gray-300 min-h-screen relative overflow-x-hidden">
  <!-- Background Effects -->
  <div class="fixed inset-0 overflow-hidden pointer-events-none">
    <div class="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl float"></div>
    <div class="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl float" style="animation-delay: -3s;"></div>
    <div class="absolute top-1/2 left-1/2 w-96 h-96 bg-red-500/5 rounded-full blur-3xl"></div>
  </div>

  <div class="relative z-10 max-w-6xl mx-auto p-6 lg:p-10 space-y-8">
    
    <!-- Branding -->
    <div class="flex items-center gap-3 text-gray-500">
      <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span class="mono text-sm font-medium">CanxJS</span>
    </div>

    <!-- Main Error Card -->
    <div class="gradient-border">
      <div class="glass rounded-2xl p-8 shadow-2xl">
        <!-- Status Badge -->
        <div class="flex items-center gap-4 mb-6">
          <div class="${config.bgColor} ${config.borderColor} border px-4 py-2 rounded-xl flex items-center gap-3">
            <span class="text-2xl">${config.icon}</span>
            <span class="${config.color} mono font-bold text-lg">${status}</span>
            <span class="text-gray-400 mono text-sm">${code}</span>
          </div>
          <div class="flex items-center gap-2 text-gray-500 mono text-sm">
            <span class="px-2 py-1 bg-gray-800 rounded">${req.method}</span>
            <span class="truncate max-w-md">${url.pathname}</span>
          </div>
        </div>

        <!-- Error Message -->
        <h1 class="text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">${error.message}</h1>
        <div class="text-gray-400 text-lg">${specialSuggestion}</div>
        
        ${viewInfo ? `
        <!-- View Not Found Details -->
        <div class="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <h3 class="text-blue-400 font-semibold mb-2">🗂️ View Details</h3>
          <div class="mono text-sm space-y-1">
            <p><span class="text-gray-500">Looking for:</span> <span class="text-white">${viewInfo.viewPath}</span></p>
            ${viewInfo.searchedPaths.length > 0 ? `
            <p class="text-gray-500 mt-2">Searched in:</p>
            <ul class="list-disc list-inside text-gray-400 ml-2">
              ${viewInfo.searchedPaths.map(p => `<li>${p}</li>`).join('')}
            </ul>
            ` : ''}
          </div>
        </div>
        ` : ''}
        
        ${validationErrors ? `
        <!-- Validation Errors -->
        <div class="mt-6 p-4 bg-pink-500/10 border border-pink-500/30 rounded-xl">
          <h3 class="text-pink-400 font-semibold mb-3">📝 Validation Errors</h3>
          <div class="space-y-2">
            ${Object.entries(validationErrors).map(([field, errors]: [string, any]) => `
            <div class="flex gap-3">
              <span class="mono text-pink-400 font-medium min-w-[120px]">${field}</span>
              <span class="text-gray-400">${Array.isArray(errors) ? errors.join(', ') : errors}</span>
            </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left: Code & Stack Trace -->
      <div class="lg:col-span-2 space-y-6">
        
        ${fileContext ? `
        <!-- Code Snippet -->
        <div class="glass rounded-2xl overflow-hidden border border-gray-800/50 shadow-xl">
          <div class="bg-[#0f1520] px-5 py-3 border-b border-gray-800/50 flex justify-between items-center">
            <div class="flex items-center gap-3">
              <div class="flex gap-1.5">
                <div class="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div class="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <span class="mono text-xs text-gray-500 truncate max-w-md">${fileContext.file}</span>
            </div>
            <span class="mono text-xs text-gray-600">Line ${fileContext.line}</span>
          </div>
          <div class="p-5 overflow-x-auto bg-[#0f1520]">
            <pre class="mono text-sm leading-7" style="counter-reset: line ${fileContext.startLine - 1};">
${fileContext.snippet}
            </pre>
          </div>
        </div>
        ` : ''}

        <!-- Stack Trace -->
        <div class="glass rounded-2xl border border-gray-800/50 shadow-xl p-6">
          <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-3">
            <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            Stack Trace
          </h2>
          <div class="space-y-2 mono text-sm max-h-96 overflow-y-auto">
            ${stack.split('\n').slice(1).map((line, i) => {
              const isAppCode = !line.includes('node_modules');
              const isFirst = i === 0;
              return `
              <div class="p-3 rounded-lg transition-all ${isFirst ? 'bg-red-500/10 border border-red-500/30' : isAppCode ? 'bg-blue-500/5 border-l-2 border-blue-500/50 hover:bg-blue-500/10' : 'text-gray-600 hover:text-gray-400'} break-all">
                ${line.trim().replace(/^at /, '<span class="text-gray-600 mr-2">at</span>')}
              </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Right: Context Panel -->
      <div class="space-y-6">
        
        <!-- Request Info -->
        <div class="glass rounded-2xl border border-gray-800/50 shadow-xl p-6">
          <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Request
          </h2>
          
          <div class="space-y-4">
            <div>
              <h3 class="text-xs uppercase text-gray-500 font-bold mb-2">URL</h3>
              <div class="bg-[#0f1520] rounded-lg p-3 mono text-xs text-gray-400 break-all">
                ${req.url}
              </div>
            </div>
            
            <div>
              <h3 class="text-xs uppercase text-gray-500 font-bold mb-2">Headers</h3>
              <div class="bg-[#0f1520] rounded-lg p-3 text-xs mono space-y-1.5 max-h-48 overflow-y-auto">
                ${(Array.from(req.headers as any) as [string, string][]).slice(0, 8).map(([k, v]) => `
                <div class="flex gap-2">
                  <span class="text-cyan-400 min-w-[80px] truncate">${k}</span>
                  <span class="text-gray-500 truncate">${v}</span>
                </div>
                `).join('')}
              </div>
            </div>
            
            ${url.search ? `
            <div>
              <h3 class="text-xs uppercase text-gray-500 font-bold mb-2">Query</h3>
              <div class="bg-[#0f1520] rounded-lg p-3 text-xs mono text-gray-400">
                <pre>${JSON.stringify(Object.fromEntries(url.searchParams), null, 2)}</pre>
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Environment -->
        <div class="glass rounded-2xl border border-gray-800/50 shadow-xl p-6">
          <h2 class="text-lg font-semibold text-white mb-4">Environment</h2>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div class="text-gray-500 text-xs uppercase mb-1">Runtime</div>
              <div class="text-white flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                Bun ${typeof Bun !== 'undefined' ? Bun.version : 'N/A'}
              </div>
            </div>
            <div>
              <div class="text-gray-500 text-xs uppercase mb-1">Mode</div>
              <div class="text-amber-400">Development</div>
            </div>
            <div>
              <div class="text-gray-500 text-xs uppercase mb-1">Framework</div>
              <div class="text-white">CanxJS</div>
            </div>
            <div>
              <div class="text-gray-500 text-xs uppercase mb-1">Time</div>
              <div class="text-gray-400 mono text-xs">${new Date().toISOString()}</div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="glass rounded-2xl border border-gray-800/50 shadow-xl p-6">
          <h2 class="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div class="space-y-3">
            <button onclick="location.reload()" class="w-full px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Retry Request
            </button>
            <button onclick="history.back()" class="w-full px-4 py-3 rounded-xl bg-gray-500/10 border border-gray-500/30 text-gray-400 hover:bg-gray-500/20 transition-all flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center text-gray-600 text-sm py-8">
      <p>Powered by <span class="text-gray-400">CanxJS</span> • This error page is only visible in development mode</p>
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
      
      const bunFile = Bun.file(file);
      if (!(await bunFile.exists())) return null;
      
      const fileContent = await bunFile.text();
      const lines = fileContent.split('\n');
      
      const start = Math.max(0, line - 8);
      const end = Math.min(lines.length, line + 8);
      
      const snippet = lines.slice(start, end).map((l, i) => {
        const currentLine = start + i + 1;
        const isHighlight = currentLine === line;
        return `<div class="code-line ${isHighlight ? 'highlight' : ''}">${this.escapeHtml(l) || ' '}</div>`;
      }).join('');

      return { file, line, snippet, startLine: start + 1 };
    } catch {
      return null;
    }
  }
  
  /**
   * Escape HTML special characters
   */
  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
