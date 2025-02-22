import { WebSocketServer } from "ws";
import { UserManager } from "./UserManager";
import { subscriberRedisClient } from "./redis";
import { RoomManager } from "./RoomManager";

const PORT = parseInt(process.env.PORT || "3001");

const subscribeToGlobalChannel = async () => {
  await subscriberRedisClient.subscribe("global", (data) => {
    const parsedData = JSON.parse(data);
    RoomManager.getInstance().handleMessageFromGlobalChannel(parsedData);
  });
};

const main = async () => {
  try {
    const wss = new WebSocketServer({
      port: PORT,
      verifyClient: (info, done) => {
        try {
          const queryParams = new URLSearchParams(info.req.url?.split("?")[1]);
          const userName = queryParams.get("user_name");

          if (!userName) {
            done(false, 401, "Missing user name in query parameters");
          } else {
            done(true);
          }
        } catch (error) {
          done(false, 500, "Internal Server Error");
        }
      },
    });

    wss.on("connection", (ws, req) => {
      try {
        const queryParams = new URLSearchParams(req.url?.split("?")[1]);
        const userName = queryParams.get("user_name") as string;
        console.log(`User with user name: ${userName} connected.`);
        UserManager.getInstance().addUser(ws, userName);

        ws.on("error", (err) => {
          console.error(`Error on WebSocket connection for user name: ${userName}`, err);
        });
      } catch (error) {
        console.error("Error during connection handling:", error);
      }
    });
    console.log("WebSocket server started on port ", PORT);
    subscribeToGlobalChannel();
  } catch (error) {
    console.log("Error occured :", error);
  }
};

main();
