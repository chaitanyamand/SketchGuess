"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SignalingManager } from "../utils/SignalingManager"


export default function Home() {
  const [username, setUsername] = useState("")
  const [roomId, setRoomId] = useState("")
  const [joinMode, setJoinMode] = useState(false)
  const router = useRouter()

  const handleCreateRoom = () => {
    if (username) {
      SignalingManager.getInstance(username).sendMessage({type : "CREATE"});
      SignalingManager.getInstance(username).registerCallback("CREATED",(roomId : string)=>{
        localStorage.setItem("sketchguess",JSON.stringify({
            username , roomId, creator : true
          }));
        SignalingManager.getInstance(username).deRegisterCallback("CREATE","CREATE:HOME");
      },"CREATED:HOME")
      router.push("/room");
    }
  }

  const handleJoinRoom = () => {
    if (username && roomId) {
      localStorage.setItem("sketchguess",JSON.stringify({
        username , roomId, creator : false
      }));
      router.push("/room");
    }
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gray-200">
  <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
    <div className="text-center">
      <h2 className="text-3xl font-bold text-black">Welcome to SketchGuess</h2>
      <p className="mt-2 text-sm text-gray-600">
        Enter your name and choose an option to play
      </p>
    </div>
    <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
      <input
        className="w-full p-3 border rounded-md text-gray-900 outline-none focus:ring-2 focus:ring-gray-400"
        type="text"
        placeholder="Your Name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      {joinMode && (
        <input
          className="w-full p-3 border rounded-md text-gray-900 outline-none focus:ring-2 focus:ring-gray-400"
          type="text"
          placeholder="Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          required
        />
      )}
      <div className="flex flex-col space-y-3">
        {joinMode ? (
          <>
            <button
              className="w-full bg-black text-white py-3 rounded-md font-medium disabled:opacity-50"
              onClick={handleJoinRoom}
              disabled={!username || !roomId}
            >
              Join Room
            </button>
            <button
              className="w-full bg-gray-100 text-black py-3 rounded-md font-medium"
              onClick={() => setJoinMode(false)}
            >
              Back
            </button>
          </>
        ) : (
          <>
            <button
              className="w-full bg-black text-white py-3 rounded-md font-medium disabled:opacity-50"
              onClick={handleCreateRoom}
              disabled={!username}
            >
              Create Room
            </button>
            <button
              className="w-full bg-white border border-gray-300 text-black py-3 rounded-md font-medium"
              onClick={() => setJoinMode(true)}
            >
              Join Existing Room
            </button>
          </>
        )}
      </div>
    </form>
  </div>
</div>

  )
}
