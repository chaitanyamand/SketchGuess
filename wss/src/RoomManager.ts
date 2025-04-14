import { RedisClientType } from "redis";
import { User } from "./User";
import { publisherRedisClient, redisClient } from "./redis";
import { getRandomPictionaryWord } from "./dictionary";
import "crypto";
import { UUID } from "crypto";

export class RoomManager {
  private static instance: RoomManager;
  private room: Map<User, string> = new Map();
  private participants: Map<string, Set<User>> = new Map();
  private redisClient: RedisClientType;
  private publisherRedisClient: RedisClientType;
  private instanceID: UUID;

  private logicalClock: number = 0;
  private requestingCS: Map<string, boolean> = new Map();
  private requestTimestamps: Map<string, number> = new Map();
  private deferredResponses: Map<string, Set<string>> = new Map();
  private receivedResponses: Map<string, Set<string>> = new Map();
  private allNodes: Set<string> = new Set();
  private nodeLastSeen: Map<string, number> = new Map();
  private requestingUsers: Map<string, User> = new Map();

  private constructor() {
    this.instanceID = crypto.randomUUID();
    this.redisClient = redisClient;
    this.publisherRedisClient = publisherRedisClient;
    this.startHeartbeat();
    this.startNodeFailureDetection();
  }

  public static getInstance() {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  private incrementClock(): number {
    return ++this.logicalClock;
  }

  private updateClock(receivedTimestamp: number): void {
    this.logicalClock = Math.max(this.logicalClock, receivedTimestamp) + 1;
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
    await this.redisClient.rPush(`participants:${roomId}`, JSON.stringify(participantToEnqueue));
    const messageToBroadcast = {
      type: "PARTICIPANT_JOINED",
      user_name: userName,
    };
    this.broadcastToRoomExceptSender(roomId, messageToBroadcast, user);
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
    const messageToBroadcast = {
      type: "PARTICIPANT_LEFT",
      user_name: userName,
    };
    this.broadcastToRoom(roomId, messageToBroadcast);
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
    await this.redisClient.rPush(`participants:${roomId}`, JSON.stringify(participantToEnqueue));
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
    const drawer = await this.redisClient.get(`drawer:${roomId}`);
    if (drawer && drawer == userName) {
      return;
    }
    if (correctAnswer && lowercaseChat == correctAnswer) {
      const allParticipants = this.redisClient.lRange(`participants:${roomId}`, 0, -1);
      const parsedAllParticipants = (await allParticipants).map((allParticipant) => JSON.parse(allParticipant));
      const oldParticipant = parsedAllParticipants.find((participant) => participant.name == userName);
      const newParticipant = {
        name: userName,
        score: oldParticipant.score + 1,
      };
      await this.redisClient.lRem(`participants:${roomId}`, 0, JSON.stringify(oldParticipant));
      await this.redisClient.rPush(`participants:${roomId}`, JSON.stringify(newParticipant));
      await this.cleanupForRoom(roomId);
      await this.releaseDrawingRights(roomId);

      const messageToBroadcast = {
        type: "SCORE",
        user_name: userName,
        correct_word: correctAnswer,
      };
      this.broadcastToRoom(roomId, messageToBroadcast);
      return;
    }
    const chatToPush = {
      name: userName,
      message: chat,
    };
    await this.redisClient.rPush(`chat:${roomId}`, JSON.stringify(chatToPush));
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
    await this.redisClient.del(`answer:${roomId}`);
    await this.redisClient.del(`roomRound:${roomId}`);
  }

  private broadcastToRoomExceptSender(roomId: string, messageToBroadcast: any, sender: User) {
    const messageToPublish = {
      ...messageToBroadcast,
      global_room_id: roomId,
      instance_id: this.instanceID,
    };
    this.publisherRedisClient.publish("global", JSON.stringify(messageToPublish));
    const allParticipants = this.participants.get(roomId);
    if (allParticipants) {
      [...allParticipants].filter((p) => p !== sender).forEach((p) => p.emit(messageToBroadcast));
    }
  }

  private broadcastToRoom(roomId: string, messageToBroadcast: any) {
    const messageToPublish = {
      ...messageToBroadcast,
      global_room_id: roomId,
      instance_id: this.instanceID,
    };
    this.publisherRedisClient.publish("global", JSON.stringify(messageToPublish));
    const allParticipants = this.participants.get(roomId);
    if (allParticipants) {
      allParticipants.forEach((participant) => participant.emit(messageToBroadcast));
    }
  }

  public async handleDrawingStroke(user: User, drawingData: any) {
    const roomId = this.room.get(user);
    if (!roomId) return;
    const userName = user.getUserName();
    const drawerForRoom = await this.redisClient.get(`drawer:${roomId}`);
    if (drawerForRoom && drawerForRoom == userName) {
      await this.redisClient.rPush(`drawing:${roomId}`, JSON.stringify(drawingData));
      const messageToBroadcast = {
        type: "DRAWING",
        drawing_data: drawingData,
      };
      this.broadcastToRoomExceptSender(roomId, messageToBroadcast, user);
    }
  }

  public async handleDrawingRequest(user: User) {
    await this.requestDrawingRights(user);
  }

  public async requestDrawingRights(user: User): Promise<void> {
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
      return;
    }

    if (this.requestingCS.get(roomId)) {
      user.emit({
        type: "DRAW_FAILURE",
        message: "Another user is currently requesting drawing rights",
      });
      return;
    }

    this.requestingUsers.set(roomId, user);

    this.requestingCS.set(roomId, true);
    const timestamp = this.incrementClock();
    this.requestTimestamps.set(roomId, timestamp);

    this.receivedResponses.set(roomId, new Set<string>());

    const requestMessage = {
      type: "RA_REQUEST",
      roomId: roomId,
      nodeId: this.instanceID,
      timestamp: timestamp,
      userName: userName,
    };
    console.log("Sending Request", requestMessage);
    await this.publisherRedisClient.publish("ra_channel", JSON.stringify(requestMessage));

    this.checkAndEnterCS(roomId);
  }

  private async handleCSRequest(message: any): Promise<void> {
    console.log("Handling Request", message);
    const { roomId, nodeId, timestamp, userName } = message;
    this.updateClock(timestamp);

    const requestingThisRoom = this.requestingCS.get(roomId);
    const ourTimestamp = this.requestTimestamps.get(roomId);

    if (requestingThisRoom && ourTimestamp !== undefined) {
      const wePriority = ourTimestamp < timestamp || (ourTimestamp === timestamp && this.instanceID < nodeId);

      if (wePriority) {
        let deferred = this.deferredResponses.get(roomId);
        if (!deferred) {
          deferred = new Set<string>();
          this.deferredResponses.set(roomId, deferred);
        }
        deferred.add(nodeId);
        return;
      }
    }

    const responseMessage = {
      type: "RA_RESPONSE",
      roomId: roomId,
      nodeId: this.instanceID,
      requestNodeId: nodeId,
    };

    await this.publisherRedisClient.publish("ra_channel", JSON.stringify(responseMessage));
  }

  private handleCSResponse(message: any): void {
    const { roomId, requestNodeId } = message;

    if (requestNodeId === this.instanceID) {
      console.log("Handling Response", message);
      const responses = this.receivedResponses.get(roomId);
      console.log("Responses :", responses);
      if (responses) {
        responses.add(message.nodeId);
        this.checkAndEnterCS(roomId);
      }
    }
  }

  private async checkAndEnterCS(roomId: string): Promise<void> {
    const responses = this.receivedResponses.get(roomId);
    if (!responses) {
      return;
    }

    const user = this.requestingUsers.get(roomId);
    if (!user) {
      return;
    }

    const userName = user.getUserName();

    if (responses.size >= this.allNodes.size) {
      this.requestingCS.set(roomId, false);
      this.receivedResponses.delete(roomId);
      this.requestingUsers.delete(roomId);

      const drawerForRoom = await this.redisClient.get(`drawer:${roomId}`);
      if (!drawerForRoom) {
        const pictionary_word = getRandomPictionaryWord().toLowerCase();
        const roundId = crypto.randomUUID();
        const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
        await this.redisClient.set(`drawer:${roomId}`, userName);
        await this.redisClient.set(`answer:${roomId}`, pictionary_word);
        await this.redisClient.set(`roomRound:${roomId}`, roundId);

        setTimeout(async () => {
          const roundForRoom = await this.redisClient.get(`roomRound:${roomId}`);
          if (roundForRoom && roundForRoom == roundId) {
            const messageToBroadcast = {
              type: "ROUND_TIMEOUT",
            };
            this.broadcastToRoom(roomId, messageToBroadcast);
            this.cleanupForRoom(roomId);
            await this.releaseDrawingRights(roomId);
          }
        }, FIVE_MINUTES_IN_MS);

        user.emit({
          type: "DRAW_SUCCESS",
          pictionary_word,
        });

        const messageToBroadcast = {
          type: "DRAWER",
          user_name: userName,
        };

        this.broadcastToRoomExceptSender(roomId, messageToBroadcast, user);
      }
    }
  }

  public async releaseDrawingRights(roomId: string): Promise<void> {
    await this.redisClient.del(`drawer:${roomId}`);
    await this.redisClient.del(`answer:${roomId}`);

    this.requestingCS.delete(roomId);
    this.requestingUsers.delete(roomId);

    const deferred = this.deferredResponses.get(roomId);
    if (deferred) {
      for (const nodeId of deferred) {
        const responseMessage = {
          type: "RA_RESPONSE",
          roomId: roomId,
          nodeId: this.instanceID,
          requestNodeId: nodeId,
        };

        await this.publisherRedisClient.publish("ra_channel", JSON.stringify(responseMessage));
      }
      this.deferredResponses.delete(roomId);
    }
  }

  public handleRAChannelMessage(message: string): void {
    try {
      const parsedMessage = JSON.parse(message);

      if (parsedMessage.nodeId === this.instanceID) return;

      this.allNodes.add(parsedMessage.nodeId);

      switch (parsedMessage.type) {
        case "RA_REQUEST":
          this.handleCSRequest(parsedMessage);
          break;
        case "RA_RESPONSE":
          this.handleCSResponse(parsedMessage);
          break;
        case "RA_NODE_ANNOUNCE":
          break;
      }
    } catch (error) {
      console.error("Error handling RA message:", error);
    }
  }

  public async announcePresence(): Promise<void> {
    const message = {
      type: "RA_NODE_ANNOUNCE",
      nodeId: this.instanceID,
    };

    await this.publisherRedisClient.publish("ra_channel", JSON.stringify(message));
  }

  private async startHeartbeat(): Promise<void> {
    setInterval(async () => {
      const heartbeat = {
        type: "RA_HEARTBEAT",
        nodeId: this.instanceID,
        timestamp: Date.now(),
      };

      await this.publisherRedisClient.publish("ra_heartbeat", JSON.stringify(heartbeat));
    }, 5000);
  }

  public handleHeartbeat(message: string): void {
    try {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.nodeId === this.instanceID) return;

      this.nodeLastSeen.set(parsedMessage.nodeId, Date.now());
      this.allNodes.add(parsedMessage.nodeId);
    } catch (error) {
      console.error("Error handling heartbeat:", error);
    }
  }

  private startNodeFailureDetection(): void {
    setInterval(() => {
      const now = Date.now();
      const failedNodes = [];

      for (const [nodeId, lastSeen] of this.nodeLastSeen.entries()) {
        if (now - lastSeen > 15000) {
          failedNodes.push(nodeId);
        }
      }

      for (const nodeId of failedNodes) {
        this.handleNodeFailure(nodeId);
      }
    }, 5000);
  }

  private handleNodeFailure(nodeId: string): void {
    console.log(`Node ${nodeId} failed`);
    this.allNodes.delete(nodeId);
    this.nodeLastSeen.delete(nodeId);

    for (const [roomId, responses] of this.receivedResponses.entries()) {
      responses.add(nodeId);
      this.checkAndEnterCS(roomId);
    }
  }

  public async handleRemovalOfParticipant(user: User) {
    const userName = user.getUserName();
    const roomId = this.room.get(user);
    if (!roomId) return;

    if (this.requestingUsers.get(roomId) === user) {
      this.requestingUsers.delete(roomId);
      this.requestingCS.set(roomId, false);
      this.receivedResponses.delete(roomId);
    }

    const drawerForRoom = await this.redisClient.get(`drawer:${roomId}`);
    if (drawerForRoom && drawerForRoom == userName) {
      await this.cleanupForRoom(roomId);
      await this.releaseDrawingRights(roomId);
      const messageToBroadcast = {
        type: "DRAWER_LEFT",
      };
      this.broadcastToRoomExceptSender(roomId, messageToBroadcast, user);
    }
    await this.removeUserFromRoom(user);
  }

  public handleMessageFromGlobalChannel = (parsedData: any) => {
    const receivedInstanceId = parsedData.instance_id;
    if (receivedInstanceId != this.instanceID) {
      delete parsedData.instance_id;
      const roomId = parsedData.global_room_id;
      delete parsedData.global_room_id;
      const allParticipants = this.participants.get(roomId);
      if (allParticipants) {
        allParticipants.forEach((participant) => participant.emit(parsedData));
      }
    }
  };
}
