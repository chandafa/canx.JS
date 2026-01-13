import { BaseController, Post, Get, Controller } from '../../mvc/Controller';
import { render } from '../../mvc/View';
import { Dashboard } from './Dashboard';
import { queue } from '../Queue';

@Controller('/canx-queue')
export class QueueController extends BaseController {

  @Get('/')
  index() {
    return this.response.html(render(() => Dashboard()));
  }

  @Get('/api/stats')
  async stats() {
    const stats = await queue.getStats();
    return this.json(stats);
  }

  @Get('/api/jobs/failed')
  async failed() {
    const jobs = await queue.getFailed();
    return this.json(jobs);
  }

  @Get('/api/jobs/pending')
  async pending() {
    const jobs = await queue.getPending();
    return this.json(jobs);
  }

  @Post('/api/jobs/retry/:id')
  async retry() {
    const id = this.param('id');
    if (!id) return this.json({ error: 'ID required' }, 400);

    await queue.retry(id);
    return this.json({ success: true });
  }

  @Post('/api/clear')
  async clear() {
    await queue.clear();
    return this.json({ success: true });
  }
}
