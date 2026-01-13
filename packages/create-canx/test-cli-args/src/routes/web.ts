import type { RouterInstance } from 'canxjs';
import { HomeController } from '../controllers/HomeController';

export function webRoutes(router: RouterInstance) {
  const home = new HomeController();
  
  router.get('/', (req, res) => home.index(req, res));
  router.get('/about', (req, res) => home.about(req, res));
}
