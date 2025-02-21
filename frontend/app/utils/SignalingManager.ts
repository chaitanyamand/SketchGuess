export const BASE_URL = "ws://localhost:3001";

export class SignalingManager {
  private ws: WebSocket;
  private static instance: SignalingManager;
  private bufferedMessages: any[] = [];
  private callbacks: any = {};
  private id: number;
  private initialized: boolean = false;

  private constructor(userName: string) {
    this.ws = new WebSocket(`${BASE_URL}?user_name=${userName}`);
    this.bufferedMessages = [];
    this.id = 1;
    this.init();
  }

  public static getInstance(userName: string) {
    if (!this.instance) {
      this.instance = new SignalingManager(userName);
    }
    return this.instance;
  }

  init() {
    this.ws.onopen = () => {
      this.initialized = true;
      this.bufferedMessages.forEach((message) => {
        this.ws.send(JSON.stringify(message));
      });
      this.bufferedMessages = [];
    };
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const type = message.type;
      if (this.callbacks[type]) {
        this.callbacks[type].forEach(({ callback }: any) => {
          if (type == "CREATED") {
            const roomId = message.room_id;
            callback(roomId);
          } else if (type == "SCORE") {
            const correctWord = message.correct_word;
            const userName = message.user_name;
            callback(userName, correctWord);
          } else if (type == "CHAT") {
            const userName = message.user_name;
            const chatMessage = message.chat_message;
            callback(userName, chatMessage);
          } else if (type == "DRAWING") {
            const drawingData = message.drawing_data;
            callback(drawingData);
          } else if (type == "DRAW_FAILURE") {
            const reasonMessage = message.message;
            callback(reasonMessage);
          } else if (type == "DRAW_SUCCESS") {
            const pictionaryWord = message.pictionary_word;
            callback(pictionaryWord);
          } else if (type == "DRAWER") {
            const userName = message.user_name;
            callback(userName);
          } else if (type == "DRAWER_LEFT") {
            callback();
          } else if (type == "PARTICIPANT_LEFT") {
            const userName = message.user_name;
            callback(userName);
          } else if (type == "PARTICIPANT_JOINED") {
            const userName = message.user_name;
            callback(userName);
          }
        });
      }
    };
  }

  sendMessage(message: any) {
    const messageToSend = {
      ...message,
      id: this.id++,
    };
    if (!this.initialized) {
      this.bufferedMessages.push(messageToSend);
      return;
    }
    this.ws.send(JSON.stringify(messageToSend));
  }

  registerCallback(type: string, callback: any, id: string) {
    console.log("registering callback");
    this.callbacks[type] = this.callbacks[type] || [];
    this.callbacks[type].push({ callback, id });
  }

  deRegisterCallback(type: string, id: string) {
    if (this.callbacks[type]) {
      const index = this.callbacks[type].findIndex((callback: any) => callback.id === id);
      if (index !== -1) {
        this.callbacks[type].splice(index, 1);
      }
    }
  }

  terminateConnection() {
    if (this.ws) {
      this.ws.close();
      this.initialized = false;
      this.callbacks = {};
      SignalingManager.instance = undefined as any;
    }
  }
}
