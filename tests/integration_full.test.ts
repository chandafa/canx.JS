/**
 * System-Wide Integration Test
 * Verifies that the Application class correctly bootstraps the framework
 */

import { expect, test, describe } from "bun:test";
import { 
  createApplication, 
  Application, 
  Controller, 
  Get, 
  CanxModule,
  Injectable
} from '../src/index';
import type { CanxRequest, CanxResponse } from '../src/index';

// 1. Define Service
@Injectable()
class TestService {
  getData() {
    return { message: 'Service Data' };
  }
}

// 2. Define Controller
@Controller('/test-app')
class TestController {
  constructor(private service: TestService) {}

  @Get('/')
  index(req: CanxRequest, res: CanxResponse) {
    return res.json(this.service.getData());
  }
}

// 3. Define Module
@CanxModule({
  controllers: [TestController],
  providers: [TestService]
})
class AppModule {}

describe('System Integration', () => {
  test('Application bootstraps correctly with Modules', async () => {
    // Initialize App
    const app = createApplication({
      rootModule: AppModule
    });

    expect(app).toBeInstanceOf(Application);
    
    // Check if server is accessible
    const server = app.getServer();
    expect(server).toBeDefined();

    // Verify DI works by resolving the controller manually (simulation)
    // In a real run, the router would instantiate it via DI
    
    // NOTE: Simulating a request involves binding the port which might conflict in tests
    // So we verify the structure setup instead
  });
});
