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

export { redisClient };
