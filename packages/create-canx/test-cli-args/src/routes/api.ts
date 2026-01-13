import type { RouterInstance } from 'canxjs';
import { UserController } from '../controllers/UserController';

export function apiRoutes(router: RouterInstance) {
  router.group('/api', (api) => {
    api.group('/users', (users) => {
      users.get('/', UserController.index);
      users.get('/:id', UserController.show);
      users.post('/', UserController.store);
      users.put('/:id', UserController.update);
      users.delete('/:id', UserController.destroy);
    });
  });
}
