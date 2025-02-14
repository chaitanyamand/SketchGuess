import { RedisClientType } from "redis";
import { User } from "./User";
import { redisClient } from "./redis";

export class RoomManager {
  private static instance: RoomManager;
  private room: Map<User, string> = new Map();
  private participants: Map<string, Set<User>> = new Map();
  private redisClient: RedisClientType;

  private constructor() {
    this.redisClient = redisClient;
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new RoomManager();
    }
    return this.instance;
  }

  public async addUserToRoom(user: User, roomId: string) {
    const userName = user.getUserName();
    this.room.set(user, roomId);
    const participantsOfRoom = this.participants.get(roomId);
    if (participantsOfRoom) {
      participantsOfRoom.add(user);
      this.participants.set(roomId, participantsOfRoom);
    }
    const participantToEnqueue = {
      name: userName,
      score: 0,
    };
    await this.redisClient.lPush(`participants:${roomId}`, JSON.stringify(participantToEnqueue));
  }

  private async removeUserFromRoom(user: User) {
    const roomId = this.room.get(user);
    if (!roomId) return;
    const userName = user.getUserName();
    this.room.delete(user);
    const participantsOfRoom = this.participants.get(roomId);
    if (participantsOfRoom) {
      participantsOfRoom.delete(user);
      if (participantsOfRoom.size == 0) {
        this.participants.delete(roomId);
      } else {
        this.participants.set(roomId, participantsOfRoom);
      }
    }
    await this.removeFromRedisParticipants(roomId, userName);
  }

  private async removeFromRedisParticipants(roomId: string, userName: string) {
    const allParticipants = await this.redisClient.lRange(`participants:${roomId}`, 0, -1);
    for (let i = 0; i < allParticipants.length; i++) {
      const parsedParticipant = JSON.parse(allParticipants[i]);
      if (parsedParticipant.name == userName) {
        const score = parsedParticipant.score;
        const participantToRemove = {
          name: userName,
          score: score,
        };
        await redisClient.lRem(`participants:${roomId}`, 0, JSON.stringify(participantToRemove));
      }
    }
  }

  private getRandomUUID() {
    return parseInt(crypto.randomUUID().replace(/-/g, ""), 16).toString(36).slice(0, 6);
  }

  public async createRoom(user: User) {
    const roomId = this.getRandomUUID();
    const userName = user.getUserName();
    this.room.set(user, roomId);
    const singleUserSet = new Set<User>().add(user);
    this.participants.set(roomId, singleUserSet);
    await this.redisClient.sAdd("rooms", roomId);
    await this.redisClient.lPush(`participants:${roomId}`, userName);
    const messageToSend = {
      type: "CREATED",
      room_id: roomId,
    };
    user.emit(messageToSend);
  }

  public async receiveChatMessageAndBroadcast(user: User, chat: string) {
    const roomId = this.room.get(user) || "";
    const userName = user.getUserName();
    const correctAnswer = await this.redisClient.get(`answer:${roomId}`);
    if (correctAnswer && chat == correctAnswer) {
      const allParticipants = this.redisClient.lRange(`participants:${roomId}`, 0, -1);
      const parsedAllParticipants = (await allParticipants).map((allParticipant) => JSON.parse(allParticipant));
      const oldParticipant = parsedAllParticipants.find((participant) => participant.name == userName);
      const newParticipant = {
        name: userName,
        score: oldParticipant.score + 1,
      };
      this.redisClient.lRem(`participants:${roomId}`, 0, JSON.stringify(oldParticipant));
      this.redisClient.lPush(`participants:${roomId}`, JSON.stringify(newParticipant));
      this.cleanupForRoom(roomId);
      const messageToBroadcast = {
        type: "SCORE",
        user_name: userName,
      };
      this.broadcastToRoom(roomId, messageToBroadcast);
      return;
    }
    const chatToPush = {
      name: userName,
      message: chat,
    };
    await this.redisClient.lPush(`chat:${roomId}`, JSON.stringify(chatToPush));
    const messageToBroadcast = {
      type: "CHAT",
      user_name: userName,
      chat_message: chat,
    };
    this.broadcastToRoom(roomId, messageToBroadcast);
  }

  private cleanupForRoom(roomId: string) {
    this.redisClient.del(`drawing:${roomId}`);
    this.redisClient.del(`chat:${roomId}`);
    this.redisClient.del(`drawer:${roomId}`);
  }

  //TODO :Change the type of messageToBroadcast
  private broadcastToRoomExceptSender(roomId: string, messageToBroadcast: any, sender: User) {
    const allParticipants = this.participants.get(roomId);
    if (allParticipants) {
      allParticipants.delete(sender);
      allParticipants.forEach((participant) => participant.emit(messageToBroadcast));
    }
  }

  //TODO :Change the type of messageToBroadcast
  private broadcastToRoom(roomId: string, messageToBroadcast: any) {
    const allParticipants = this.participants.get(roomId);
    if (allParticipants) {
      allParticipants.forEach((participant) => participant.emit(messageToBroadcast));
    }
  }

  //TODO :Change the type of drawingData
  public async handleDrawingStroke(user: User, drawingData: any) {
    const roomId = this.room.get(user);
    if (!roomId) return;
    const userName = user.getUserName();
    const drawerForRoom = await this.redisClient.get(`drawer:${roomId}`);
    if (drawerForRoom && drawerForRoom == userName) {
      await this.redisClient.lPush(`drawing:${roomId}`, drawingData);
      this.broadcastToRoomExceptSender(roomId, drawingData, user);
    }
  }

  public async handleDrawingRequest(user: User, wordToPaint: string) {
    const userName = user.getUserName();
    const roomId = this.room.get(user);
    if (!roomId) {
      user.emit({
        type: "DRAW_FAILURE",
        message: "User are not in any room",
      });
    }
    const drawerForRoom = await this.redisClient.get(`drawer:${roomId}`);
    if (drawerForRoom) {
      user.emit({
        type: "DRAW_FAILURE",
        message: "Someone is already drawing",
      });
    } else {
      await this.redisClient.set(`drawer:${roomId}`, userName);
      await this.redisClient.set(`answer:${roomId}`, wordToPaint);
      user.emit({
        type: "DRAW_SUCCESS",
      });
      const messageToBroadcast = {
        type: "DRAWER",
        user_name: userName,
      };
      this.broadcastToRoomExceptSender(roomId as string, messageToBroadcast, user);
    }
  }

  public async handleRemovalOfParticipant(user: User) {
    const userName = user.getUserName();
    const roomId = this.room.get(user);
    if (!roomId) return;
    const drawerForRoom = await this.redisClient.get(`drawer:${roomId}`);
    if (drawerForRoom && drawerForRoom == userName) {
      this.cleanupForRoom(roomId);
      user.emit({
        type: "DRAWER_LEFT",
      });
    }
    this.removeUserFromRoom(user);
  }
}
