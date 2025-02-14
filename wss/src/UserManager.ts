import { WebSocket } from "ws";
import { User } from "./User";
import { RedisClientType } from "redis";
import { redisClient } from "./redis";
import { RoomManager } from "./RoomManager";

export class UserManager {
  private static instance: UserManager;
  private socketToUsername: Map<WebSocket, User> = new Map();
  private redisClient: RedisClientType;

  private constructor() {
    this.redisClient = redisClient;
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new UserManager();
    }
    return this.instance;
  }

  public addUser(ws: WebSocket, userName: string) {
    const name = userName;
    const user = new User(name, ws);
    this.socketToUsername.set(ws, user);
    this.registerOnClose(ws);
    return user;
  }

  private registerOnClose(ws: WebSocket) {
    ws.on("close", async () => {
      const user = this.socketToUsername.get(ws);
      if (!user) return;
      this.socketToUsername.delete(ws);
      RoomManager.getInstance().handleRemovalOfParticipant(user);
    });
  }
}
