import { RedisClientType } from "redis";
import { User } from "./User";
import { redisClient } from "./redis";
import { getRandomPictionaryWord } from "./dictionary";

export class RoomManager {
  private static instance: RoomManager;
  private room: Map<User, string> = new Map();
  private participants: Map<string, Set<User>> = new Map();
  private redisClient: RedisClientType;

  private constructor() {
    this.redisClient = redisClient;
  }

  public static getInstance() {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  public async addUserToRoom(user: User, roomId: string) {
    const userName = user.getUserName();
    this.room.set(user, roomId);
    const participantsOfRoom = this.participants.get(roomId);
    if (participantsOfRoom) {
      participantsOfRoom.add(user);
      this.participants.set(roomId, participantsOfRoom);
    } else {
      const singleUserSet = new Set<User>().add(user);
      this.participants.set(roomId, singleUserSet);
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

    for (const participant of allParticipants) {
      const parsedParticipant = JSON.parse(participant);
      if (parsedParticipant.name === userName) {
        await this.redisClient.lRem(`participants:${roomId}`, 1, participant);
        break;
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
    const participantToEnqueue = {
      name: userName,
      score: 0,
    };
    this.participants.set(roomId, singleUserSet);
    await this.redisClient.sAdd("rooms", roomId);
    await this.redisClient.lPush(`participants:${roomId}`, JSON.stringify(participantToEnqueue));
    const messageToSend = {
      type: "CREATED",
      room_id: roomId,
    };
    user.emit(messageToSend);
  }

  public async receiveChatMessageAndBroadcast(user: User, chat: string) {
    const lowercaseChat = chat.toLowerCase();
    const roomId = this.room.get(user) || "";
    const userName = user.getUserName();
    const correctAnswer = await this.redisClient.get(`answer:${roomId}`);
    if (correctAnswer && lowercaseChat == correctAnswer) {
      const allParticipants = this.redisClient.lRange(`participants:${roomId}`, 0, -1);
      const parsedAllParticipants = (await allParticipants).map((allParticipant) => JSON.parse(allParticipant));
      const oldParticipant = parsedAllParticipants.find((participant) => participant.name == userName);
      const newParticipant = {
        name: userName,
        score: oldParticipant.score + 1,
      };
      await this.redisClient.lRem(`participants:${roomId}`, 0, JSON.stringify(oldParticipant));
      await this.redisClient.lPush(`participants:${roomId}`, JSON.stringify(newParticipant));
      await this.cleanupForRoom(roomId);
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

  private async cleanupForRoom(roomId: string) {
    await this.redisClient.del(`drawing:${roomId}`);
    await this.redisClient.del(`chat:${roomId}`);
    await this.redisClient.del(`drawer:${roomId}`);
  }

  //TODO :Change the type of messageToBroadcast
  private broadcastToRoomExceptSender(roomId: string, messageToBroadcast: any, sender: User) {
    const allParticipants = this.participants.get(roomId);
    if (allParticipants) {
      [...allParticipants].filter((p) => p !== sender).forEach((p) => p.emit(messageToBroadcast));
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
      await this.redisClient.lPush(`drawing:${roomId}`, JSON.stringify(drawingData));
      this.broadcastToRoomExceptSender(roomId, drawingData, user);
    }
  }

  public async handleDrawingRequest(user: User) {
    const userName = user.getUserName();
    const roomId = this.room.get(user);
    if (!roomId) {
      user.emit({
        type: "DRAW_FAILURE",
        message: "User is not in any room",
      });
      return;
    }
    const drawerForRoom = await this.redisClient.get(`drawer:${roomId}`);
    if (drawerForRoom) {
      user.emit({
        type: "DRAW_FAILURE",
        message: "Someone is already drawing",
      });
    } else {
      const pictionary_word = getRandomPictionaryWord().toLowerCase();
      await this.redisClient.set(`drawer:${roomId}`, userName);
      await this.redisClient.set(`answer:${roomId}`, pictionary_word);
      user.emit({
        type: "DRAW_SUCCESS",
        pictionary_word,
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
      await this.cleanupForRoom(roomId);
      user.emit({
        type: "DRAWER_LEFT",
      });
    }
    await this.removeUserFromRoom(user);
  }
}
