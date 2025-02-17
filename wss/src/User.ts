import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";

export class User {
  private name: string;
  private ws: WebSocket;

  constructor(name: string, ws: WebSocket) {
    this.name = name;
    this.ws = ws;
    this.addListeners();
  }

  //TODO :Change the type of message
  emit(message: any) {
    this.ws.send(JSON.stringify(message));
  }

  private addListeners() {
    this.ws.on("message", async (message: string) => {
      //TODO :Change the type of param
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.type == "CREATE") {
        RoomManager.getInstance().createRoom(this);
      } else if (parsedMessage.type == "JOIN") {
        const roomId = parsedMessage.room_id;
        RoomManager.getInstance().addUserToRoom(this, roomId);
      } else if (parsedMessage.type == "REMOVE") {
        RoomManager.getInstance().handleRemovalOfParticipant(this);
      } else if (parsedMessage.type == "CHAT") {
        const chatMessage = parsedMessage.chat_message;
        RoomManager.getInstance().receiveChatMessageAndBroadcast(this, chatMessage);
      } else if (parsedMessage.type == "DRAW") {
        RoomManager.getInstance().handleDrawingRequest(this);
      } else if (parsedMessage.type == "DRAWING") {
        const drawingData = parsedMessage.drawing_data;
        RoomManager.getInstance().handleDrawingStroke(this, drawingData);
      }
    });
  }

  public getUserName() {
    return this.name;
  }
}
