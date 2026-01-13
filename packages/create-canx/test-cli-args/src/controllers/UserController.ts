import type { CanxRequest, CanxResponse } from 'canxjs';
import { User } from '../models/User';
import { validate } from 'canxjs';

export class UserController {
  static async index(req: CanxRequest, res: CanxResponse) {
    const users = await User.all();
    return res.json({ data: users });
  }

  static async show(req: CanxRequest, res: CanxResponse) {
    const user = await User.find(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ data: user });
  }

  static async store(req: CanxRequest, res: CanxResponse) {
    const body = await req.json();
    const { valid, errors, data } = validate(body, {
      name: ['required', 'string', 'min:2'],
      email: ['required', 'email'],
      password: ['required', 'min:8'],
    });

    if (!valid) return res.status(422).json({ errors: Object.fromEntries(errors) });
    
    const user = await User.create(data);
    return res.status(201).json({ data: user });
  }

  static async update(req: CanxRequest, res: CanxResponse) {
    const body = await req.json();
    const updated = await User.updateById(req.params.id, body);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    return res.json({ message: 'User updated' });
  }

  static async destroy(req: CanxRequest, res: CanxResponse) {
    const deleted = await User.deleteById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    return res.status(204).empty();
  }
}
