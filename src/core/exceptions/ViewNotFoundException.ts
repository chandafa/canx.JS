import { HttpException } from './HttpException';

export class ViewNotFoundException extends HttpException {
  public viewPath: string;
  public searchedPaths: string[];

  constructor(viewPath: string, searchedPaths: string[] = []) {
    super(`View not found: ${viewPath}`, 404);
    this.code = 'VIEW_NOT_FOUND';
    this.viewPath = viewPath;
    this.searchedPaths = searchedPaths;
  }
}
