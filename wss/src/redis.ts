import { RedisClientType, createClient } from "redis";
import config from "./config";

const createRedisClient = (type: string) => {
  const client: RedisClientType = createClient({ url: config.redis.url });

  client.on("error", (err) => {
    console.error(`${type} Redis Client Error:`, err);
  });

  client
    .connect()
    .then(() => {
      console.log(`Connected to ${type} Redis server successfully.`);
    })
    .catch((err) => {
      console.error(`Error connecting to ${type} Redis:`, err);
    });

  return client;
};

const redisClient = createRedisClient("Normal");
const publisherRedisClient = createRedisClient("Publisher");
const subscriberRedisClient = createRedisClient("Subscriber");

export { redisClient, publisherRedisClient, subscriberRedisClient };
