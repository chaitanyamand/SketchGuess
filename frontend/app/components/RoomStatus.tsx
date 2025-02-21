import { Button } from "@/components/ui/button"
import { DrawerStatus } from "../room/page"
import { SignalingManager } from "../utils/SignalingManager"

interface RoomStatusProps {
    roomId: string | null
    drawerStatus : DrawerStatus,
    picWord : string | null,
    onJoinRequest : (userName : string) => void
    username:string | null
  }
  
  

  export default function RoomStatus({ roomId, drawerStatus,picWord, onJoinRequest, username}: RoomStatusProps) {
    
    const handleRequest = () => {
      if(username)
      {
        onJoinRequest(username);
      }
    }

    return (
      <div className="bg-white p-4 rounded-lg shadow-md text-center">
        <div className="mb-2">
          <span className="text-gray-600">Room ID: </span>
          <span className="text-gray-900 font-mono font-bold">{roomId == null ? "Loading" : roomId}</span>
        </div>
        {drawerStatus.someoneDrawing ? <div className="text-lg font-semibold text-gray-900">
          {drawerStatus.userDrawing ? `You are drawing! Your Word : ${picWord as string}` : `${drawerStatus.otherUserDrawing} is drawing`}
          </div> : <Button type="submit" className="bg-blue-500 text-white" onClick={handleRequest}>Wanna Draw?</Button>}
      </div>
    )
  }