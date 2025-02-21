import { RedisClientType, createClient } from "redis";
import config from "./config";

const createRedisClient = () => {
  const client: RedisClientType = createClient({ url: config.redis.url });

  client.on("error", (err) => {
    console.error("Redis Client Error:", err);
  });

  client
    .connect()
    .then(() => {
      console.log("Connected to Redis server successfully.");
    })
    .catch((err) => {
      console.error("Error connecting to Redis:", err);
    });

  return client;
};

const redisClient = createRedisClient();

export const checkIfRoomIsValid = async (roomId: string): Promise<boolean> => {
  return redisClient.sIsMember("rooms", roomId);
};

export const getQueue = async (type: string, roomId: string) => {
  if (type == "chat") {
    const chatForRoom = await redisClient.lRange(`chat:${roomId}`, 0, -1);
    const parsedChat = chatForRoom.map((stringifiedChatMessage) => {
      return JSON.parse(stringifiedChatMessage);
    });
    return parsedChat;
  } else if (type == "drawing") {
    const drawingForRoom = await redisClient.lRange(`drawing:${roomId}`, 0, -1);
    const parsedDrawing = drawingForRoom.map((stringifiedDrawingStroke) => {
      return JSON.parse(stringifiedDrawingStroke);
    });
    return parsedDrawing;
  }
};

export const getDrawer = async (roomId: string) => {
  const stringifiedDrawer = await redisClient.get(`drawer:${roomId}`);
  return stringifiedDrawer;
};

export const checkIfUsernameAlreadyExistsAndGetParticipants = async (roomId: string, userName: string) => {
  const participantsForRoom = await redisClient.lRange(`participants:${roomId}`, 0, -1);
  const parsedParticipants = participantsForRoom.map((stringifiedParticipant) => {
    return JSON.parse(stringifiedParticipant);
  });
  for (const parsedParticipant of parsedParticipants) {
    if (parsedParticipant.name == userName) {
      return { alreadyExists: true, participants: null };
    }
  }
  return { alreadyExists: false, participants: parsedParticipants };
};
