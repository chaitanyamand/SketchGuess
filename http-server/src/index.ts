import express, { RequestHandler } from "express";
import { checkIfRoomIsValid, checkIfUsernameAlreadyExists, getDrawer, getQueue } from "./redis";

const app = express();
const PORT = 3000;

app.use(express.json());

const roomDataHandler: RequestHandler = async (req: any, res: any) => {
  const { roomId } = req.params;
  const userName = req.query.user_name;

  if (!userName) {
    return res.status(400).json({
      status: "error",
      message: "Username required in query params",
    });
  }

  const isRoomValid = await checkIfRoomIsValid(roomId);
  if (!isRoomValid) {
    return res.status(400).json({
      status: "error",
      message: "Room ID is not valid",
    });
  }

  const isUsernameExisting = await checkIfUsernameAlreadyExists(roomId, userName);
  if (isUsernameExisting) {
    return res.status(200).json({
      status: "error",
      message: "Username already exists for this room",
    });
  }

  const chatForRoom = await getQueue("chat", roomId);
  const drawingForRoom = await getQueue("drawing", roomId);
  const drawerForRoom = await getDrawer(roomId);

  return res.status(200).json({
    status: "success",
    chat: chatForRoom ?? [],
    drawing: drawingForRoom ?? [],
    drawer: drawerForRoom ?? "No drawer",
  });
};

app.get("/room/data/:roomId", roomDataHandler);

app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
