import type { CanxRequest, CanxResponse, MiddlewareHandler, NextFunction } from '../types';
import { getRequestStorage } from '../container/Scope';
import { inertiaManager } from './InertiaManager';

export function inertiaMiddleware(): MiddlewareHandler {
  return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
    // 1. Check if Inertia Request
    const isInertia = req.headers.get('x-inertia') === 'true';
    
    // Attach an inertia context to the request for scoped sharing
    const scopeProps: Record<string, any> = {};
    
    // Helper to share data for THIS request only
    (req as any).inertiaShare = (key: string | Record<string, any>, value?: any) => {
        if (typeof key === 'string') {
            scopeProps[key] = value;
        } else {
            Object.assign(scopeProps, key);
        }
    };
    
    // 2. Asset Versioning
    if (isInertia && req.method === 'GET') {
        const version = await inertiaManager.getVersion();
        const headerVersion = req.headers.get('x-inertia-version');
        
        if (version && headerVersion !== version) {
            // Asset version mismatch -> Force full reload
            res.status(409).header('X-Inertia-Location', req.raw.url);
            return res.empty();
        }
    }

    // 3. Setup Response Helper
    // We override or attach `res.inertia` here
    res.inertia = async (component: string, props: Record<string, any> = {}) => {
        const version = await inertiaManager.getVersion();
        const globalProps = inertiaManager.getShared();
        
        // Merge props: Global -> Request Scope -> Controller Props
        const allProps = { ...globalProps, ...scopeProps, ...props };
        
        // Lazy Evaluation (Partial Reloads)
        const partialData = req.headers.get('x-inertia-partial-data');
        const partialComponent = req.headers.get('x-inertia-partial-component');
        
        let finalProps = allProps;

        if (isInertia && partialData && partialComponent === component) {
            const only = partialData.split(',').map(s => s.trim());
            const newProps: Record<string, any> = {};
            for (const key of only) {
                if (key in allProps) {
                    newProps[key] = allProps[key];
                }
            }
            finalProps = newProps;
        }
        
        // Resolve Lazy Props (functions)
        for (const key in finalProps) {
            if (typeof finalProps[key] === 'function') {
                try {
                    finalProps[key] = await finalProps[key]();
                } catch (e) {
                    console.error(`[Inertia] Error resolving prop ${key}:`, e);
                    finalProps[key] = null;
                }
            }
        }

        const page = {
            component,
            props: finalProps,
            url: req.raw.url, // Original URL
            version: version || '',
        };

        if (isInertia) {
            // JSON Response
            res.header('X-Inertia', 'true')
               .header('Content-Type', 'application/json')
               .header('Vary', 'Accept');
            
            return res.json(page);
        } else {
            // HTML Full Page Load
            const rootView = inertiaManager.getRootView();
            const encodedPage = JSON.stringify(page).replace(/"/g, '&quot;');
            
            // We need a way to render the root view with the app payload
            // In Laravel/Blade: <div id="app" data-page="{{ json($page) }}"></div>
            // Here, we'll try to use the view engine if available.
            // Assumption: The user creates a view that prints `inertiaHead` and `inertiaBody`?
            // Or simpler: We inject it into a template placeholder.
            
            // Let's assume standard SSR/View usage.
            // For now, we will construct a basic HTML shell if NO view engine is found, 
            // OR render the view passing `page` string.
            
            try {
                // Try to render the root view, passing 'page' variable
                // The root view should have: <div id="app" data-page='<%= page %>'></div>
                // or React-style.
                
                // Construct a default html if view is likely missing or simple usage
                const customView = await import('../mvc/View').then(m => m.viewIfExists(rootView, { page: page }));
                
                if (customView) {
                     return res.html(customView);
                }
                
                // Fallback default HTML
                const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${component}</title>
    <!-- Inertia Head -->
</head>
<body>
    <div id="app" data-page="${encodedPage}"></div>
    <!-- Scripts -->
</body>
</html>`;
                return res.html(html);

            } catch (e) {
                console.error('[Inertia] View render error:', e);
                return res.status(500).text('Inertia View Error');
            }
        }
    };

    // 4. Handle External Redirects (303 for PUT/PATCH/DELETE)
    // Common inertia pattern: non-GET requests redirecting must use 303 to avoid method preservation
    const originalRedirect = res.redirect;
    res.redirect = (url: string, status?: number) => {
        if (isInertia && ['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            status = 303;
        }
        return originalRedirect.call(res, url, status as any);
    };

    return next();
  };
}
