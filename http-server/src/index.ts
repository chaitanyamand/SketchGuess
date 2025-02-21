import express, { RequestHandler } from "express";
import { checkIfRoomIsValid, checkIfUsernameAlreadyExistsAndGetParticipants, getDrawer, getQueue } from "./redis";
import cors from "cors";
const app = express();
const PORT = 3000;

app.use(cors());
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

  const isUsernameExistingAndParticipants = await checkIfUsernameAlreadyExistsAndGetParticipants(roomId, userName);
  if (isUsernameExistingAndParticipants.alreadyExists) {
    return res.status(200).json({
      status: "error",
      message: "Username already exists for this room",
    });
  }
  const participantsForRoom = isUsernameExistingAndParticipants.participants;
  const chatForRoom = await getQueue("chat", roomId);
  const drawingForRoom = await getQueue("drawing", roomId);
  const drawerForRoom = await getDrawer(roomId);

  return res.status(200).json({
    status: "success",
    chat: chatForRoom ?? [],
    drawing: drawingForRoom ?? [],
    drawer: drawerForRoom ?? "No drawer",
    participants: participantsForRoom ?? [],
  });
};

app.get("/room/data/:roomId", roomDataHandler);

app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
