import { BaseController, Controller, Get } from 'canxjs';
import { renderPage, jsx } from 'canxjs';
import type { CanxRequest, CanxResponse } from 'canxjs';

@Controller('/')
export class HomeController extends BaseController {
  @Get('/')
  index(req: CanxRequest, res: CanxResponse) {
    const html = renderPage(
      jsx('div', { className: 'container' },
        jsx('h1', null, 'Welcome to CanxJS!'),
        jsx('p', null, 'Ultra-fast async-first MVC framework for Bun'),
        jsx('a', { href: '/about' }, 'About')
      ),
      { title: 'Home - CanxJS' }
    );
    return res.html(html);
  }

  @Get('/about')
  about(req: CanxRequest, res: CanxResponse) {
    const html = renderPage(
      jsx('div', { className: 'container' },
        jsx('h1', null, 'About CanxJS'),
        jsx('ul', null,
          jsx('li', null, '🚀 Ultra-fast Bun runtime'),
          jsx('li', null, '⚡ Async-first design'),
          jsx('li', null, '🔥 HotWire real-time streaming'),
          jsx('li', null, '🧠 Auto-caching layer')
        ),
        jsx('a', { href: '/' }, 'Back to Home')
      ),
      { title: 'About - CanxJS' }
    );
    return res.html(html);
  }
}
