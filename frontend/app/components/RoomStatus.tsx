import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { DrawerStatus } from "../room/page"

interface RoomStatusProps {
  roomId: string | null
  drawerStatus: DrawerStatus
  picWord: string | null
  onJoinRequest: (userName: string) => void
  username: string | null
  endTime: number | null
}

export default function RoomStatus({ roomId, drawerStatus, picWord, onJoinRequest, username, endTime }: RoomStatusProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!endTime) {
      setTimeLeft(null)
      return
    }

    const updateTimer = () => {
      const now = Date.now()
      const diff = Math.max(0, Math.floor((endTime - now) / 1000))
      setTimeLeft(diff)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [endTime])

  const handleRequest = () => {
    if (username) {
      onJoinRequest(username)
    }
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-md text-center">
      <div className="mb-2">
        <span className="text-gray-600">Room ID: </span>
        <span className="text-gray-900 font-mono font-bold">{roomId == null ? "Loading" : roomId}</span>
      </div>

      {timeLeft !== null && (
        <div className="mb-2 text-sm font-bold text-black-500">
          Time Left: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
      )}

      {drawerStatus.someoneDrawing ? (
        <div className="text-lg font-semibold text-gray-900">
          {drawerStatus.userDrawing
            ? `You are drawing! Your Word : ${picWord as string}`
            : `${drawerStatus.otherUserDrawing} is drawing`}
        </div>
      ) : (
        <Button type="submit" className="bg-blue-500 text-white" onClick={handleRequest}>
          Wanna Draw?
        </Button>
      )}
    </div>
  )
}
