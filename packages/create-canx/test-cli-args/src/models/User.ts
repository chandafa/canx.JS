import { Model } from 'canxjs';

interface UserType {
  id: number;
  name: string;
  email: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export class User extends Model<UserType> {
  protected static tableName = 'users';
  protected static primaryKey = 'id';
  protected static timestamps = true;

  static async findByEmail(email: string): Promise<UserType | null> {
    return this.query<UserType>().where('email', '=', email).first();
  }
}
