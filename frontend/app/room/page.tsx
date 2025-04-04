"use client"

import { useEffect, useState } from "react"
import Canvas from "../components/Canvas"
import Chat, { Message } from "../components/Chat"
import Participants, { Participant } from "../components/Participants"
import RoomStatus from "../components/RoomStatus"
import { getRoomData } from "../utils/http_methods"
import { useRouter } from "next/navigation"
import { SignalingManager } from "../utils/SignalingManager"
import Loading from "../components/Loading"
import {toast} from "react-hot-toast";

export type DrawerStatus = {
  someoneDrawing : boolean,
  userDrawing : boolean,
  otherUserDrawing : string | null
}

export type DrawingStroke = { points: number[]; tension: number }
 
export default function GameRoom({ params }: { params: { roomId: string } }) {
    const [username,setUsername] = useState<string | null>(null);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [participants, setParticipants] = useState<Array<Participant>>([]);
    const [messages, setMessages] = useState<Array<Message>>([]);
    const [drawerStatus,setDrawerStatus]  = useState<DrawerStatus>({someoneDrawing:false,userDrawing:false,otherUserDrawing:null}); 
    const [drawing, setDrawing] = useState<Array<DrawingStroke>>([])
    const [picWord, setPicWord] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const router = useRouter();
    
    
    const getRoomStatusAndAttachWSListeners = async () => {
      const storageObject = localStorage.getItem("sketchguess");
      if(!storageObject) {
        router.push("/home");
      }
      const parsedStorageObject = JSON.parse(storageObject as string);
      if(!parsedStorageObject.username || !parsedStorageObject.roomId)
      {
        router.push("/home");
      }
      const {roomId,username,creator} = parsedStorageObject;
      setUsername(username);
      setRoomId(roomId);
      if(creator)
      {
        setParticipants([{name: username, score: 0}])
        attachWSListeners(username);
        return;
      }
      const http_response = await getRoomData(roomId,username);
      console.log(http_response);
      if(http_response.success)
      {
        
        setMessages(http_response.data.chat);
        setDrawing(http_response.data.drawing);
        setParticipants([...http_response.data.participants,{name: username, score: 0}])
        const drawer = http_response.data.drawer;
        (drawer != "No drawer") ? setDrawerStatus({
          someoneDrawing : true,
          userDrawing : false,
          otherUserDrawing : drawer
        }) : {}
        SignalingManager.getInstance(username).sendMessage({type : "JOIN", room_id : roomId})
        
      }
      else
      {
        toast.error(http_response.message,{duration : 4000});
        router.push("/home");
      }
      attachWSListeners(username);
    }

    const updateParticipantScore = (participantUsername: string) => {
      setParticipants(prevParticipants =>
        prevParticipants.map(participant =>
          participant.name === participantUsername
            ? { ...participant, score: participant.score + 1 }
            : participant
        )
      );
    };

    const removeDrawer= () => {
      setParticipants(prevParticipants =>
        prevParticipants.filter(participant => participant.name !== drawerStatus.otherUserDrawing)
      );
    };

    const removeParticipant = (participantUsername: string) => {
      setParticipants(prevParticipants =>
        prevParticipants.filter(participant => participant.name !== participantUsername)
      );
    };

    const addParticipant = (participantUsername: string) => {
      setParticipants(prevParticipants => 
      [...prevParticipants,{name : participantUsername, score: 0}]
      )
    }

    const attachWSListeners = (username: string) =>{
      SignalingManager.getInstance(username).registerCallback("SCORE",(participantUsername : string, correctWord:string) => {
        const nameToToast = participantUsername == username ? "You" : participantUsername;
        toast.success(`${nameToToast} got it right! Word was ${correctWord}`)
        updateParticipantScore(participantUsername);
        setDrawing([]);
        setMessages([]);
        setDrawerStatus({someoneDrawing:false, userDrawing:false, otherUserDrawing:null});
        setPicWord(null);
      },"SCORE:ROOM");
      SignalingManager.getInstance(username).registerCallback("CHAT",(userName:string,chatMessage:string) => {
        setMessages(prevMessages => [...prevMessages,{name: userName, message:chatMessage}])
      },"CHAT:ROOM");
      SignalingManager.getInstance(username).registerCallback("DRAWING", (drawingData : DrawingStroke) => {
        console.log("Drawing Received");
        setDrawing(prevDrawing => [...prevDrawing,{points:drawingData.points, tension : drawingData.tension}])
      },"DRAWING:ROOM");
      SignalingManager.getInstance(username).registerCallback("DRAW_FAILURE", (reasonMessage:string) => {
        toast.error(reasonMessage,{duration :4000});
      },"DRAW_FAILURE:ROOM");
      SignalingManager.getInstance(username).registerCallback("DRAW_SUCCESS",(pictionaryWord : string)=> {
        setDrawerStatus({someoneDrawing:true, userDrawing:true, otherUserDrawing:null});
        setPicWord(pictionaryWord);
      },"DRAW_SUCCESS:ROOM");
      SignalingManager.getInstance(username).registerCallback("DRAWER",(userName :string) =>{
        setDrawerStatus({someoneDrawing:true,userDrawing:false,otherUserDrawing:userName});
      },"DRAWER:ROOM");
      SignalingManager.getInstance(username).registerCallback("DRAWER_LEFT",() => {
        removeDrawer();
        setDrawing([]);
        setMessages([]);
        setDrawerStatus({someoneDrawing:false, userDrawing:false, otherUserDrawing:null});
        setPicWord(null);
      },"DRAWER_LEFT:ROOM");
      SignalingManager.getInstance(username).registerCallback("PARTICIPANT_LEFT",(userName: string)=> {
        toast(`${userName} Left`)
        removeParticipant(userName);
      },"PARTICIPANT_LEFT:ROOM")
      SignalingManager.getInstance(username).registerCallback("PARTICIPANT_JOINED",(userName: string)=> {
        toast(`${userName} Joined`)
        addParticipant(userName);
      },"PARTICIPANT_JOINED:ROOM")
    }

    useEffect(()=>{
      getRoomStatusAndAttachWSListeners()
      setLoading(false);
      return () => {
        if (username) {
          SignalingManager.getInstance(username).deRegisterCallback("SCORE", "SCORE:ROOM");
          SignalingManager.getInstance(username).deRegisterCallback("CHAT", "CHAT:ROOM");
          SignalingManager.getInstance(username).deRegisterCallback("DRAWING", "DRAWING:ROOM");
          SignalingManager.getInstance(username).deRegisterCallback("DRAW_FAILURE", "DRAW_FAILURE:ROOM");
          SignalingManager.getInstance(username).deRegisterCallback("DRAW_SUCCESS", "DRAW_SUCCESS:ROOM");
          SignalingManager.getInstance(username).deRegisterCallback("DRAWER", "DRAWER:ROOM");
          SignalingManager.getInstance(username).deRegisterCallback("DRAWER_LEFT", "DRAWER_LEFT:ROOM"); 
          SignalingManager.getInstance(username).deRegisterCallback("PARTICIPANT_LEFT", "PARTICIPANT_LEFT:ROOM");
          SignalingManager.getInstance(username).deRegisterCallback("PARTICIPANT_JOINED", "PARTICIPANT_JOINED:ROOM");
        }
      };
    },[])

    const handleSendMessage = (chat_message: string) => {
      if (username) {
        SignalingManager.getInstance(username).sendMessage({
          type : "CHAT",
          chat_message
        })
      }
    }

    const handleDrawRequest = (username: string) => {
      SignalingManager.getInstance(username).sendMessage({type : "DRAW"})
    }
  
    if(loading)
    {
      return <Loading></Loading>
    }
    else
    {
      return (<div className="min-h-screen bg-white text-black p-2">
        <div className="container mx-auto space-y-2">
          <RoomStatus roomId={roomId} drawerStatus={drawerStatus} picWord={picWord} username={username} onJoinRequest={handleDrawRequest}/>
  
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <Canvas isDrawingEnabled={drawerStatus.userDrawing} drawing={drawing} setDrawing={setDrawing} username={username}/>
            </div>
            <div className="lg:col-span-1 h-[500px]">
              <Chat messages={messages} onSendMessage={handleSendMessage} />
            </div>
          </div>
  
          <Participants participants={participants} />
        </div>
      </div>)
    }
  }