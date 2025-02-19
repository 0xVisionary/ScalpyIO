import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import { v4 } from "uuid";

export class CustomSqliteAdapter extends SqliteDatabaseAdapter {
  async createAccount(account) {
    try {
      const sql =
        "INSERT OR REPLACE INTO accounts (id, name, username, details, is_agent, createdAt) VALUES (?, ?, ?, ?, ?, ?)";

      const id = account.id ?? v4();
      const result = this.db
        .prepare(sql)
        .run(
          id,
          account.name ?? "User",
          account.username ?? `user_${id.substring(0, 8)}`,
          JSON.stringify(account.details ?? {}),
          account.is_agent ?? 0,
          Math.floor(Date.now() / 1000)
        );

      return result.changes > 0;
    } catch (error) {
      console.error("Error creating/updating account:", error);
      throw error;
    }
  }

  async createRoom(room) {
    try {
      const sql = "INSERT OR REPLACE INTO rooms (id, createdAt) VALUES (?, ?)";

      const id = room.id ?? v4();
      const result = this.db
        .prepare(sql)
        .run(id, Math.floor(Date.now() / 1000));

      return result.changes > 0;
    } catch (error) {
      console.error("Error creating/updating room:", error);
      throw error;
    }
  }

  async createMemory(memory, tableName) {
    return super.createMemory(memory, tableName);
  }
}
