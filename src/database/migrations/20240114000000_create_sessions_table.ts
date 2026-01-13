import { Schema, defineMigration } from '../Migration';

export default defineMigration('create_sessions_table', 
  async () => {
    // Up
    await Schema.create('sessions', (table) => {
      table.string('id').primary(); // Custom Session ID
      table.string('user_id').index();
      table.text('payload');
      table.integer('expires_at').index(); // Unix timestamp
      table.timestamp('last_activity');
    });
  },
  async () => {
    // Down
    await Schema.dropIfExists('sessions');
  }
);
