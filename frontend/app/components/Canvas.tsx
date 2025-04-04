import { Stage, Layer, Line } from "react-konva"
import { useRef, Dispatch, SetStateAction } from "react"
import { DrawingStroke } from "../room/page"
import { SignalingManager } from "../utils/SignalingManager"
import { Undo } from "lucide-react";

interface CanvasProps {
  isDrawingEnabled: boolean,
  drawing: Array<{ points: number[]; tension: number }>,
  setDrawing: Dispatch<SetStateAction<DrawingStroke[]>>,
  username: string | null
}

export default function Canvas({ isDrawingEnabled, drawing, setDrawing, username }: CanvasProps) {
  const isDrawing = useRef(false)
  const lastStrokeRef = useRef<DrawingStroke | null>(null)
  const hasSentStrokeRef = useRef(false) 

  const handleMouseDown = (e: any) => {
    if (!isDrawingEnabled) return
    isDrawing.current = true
    hasSentStrokeRef.current = false 

    const pos = e.target.getStage().getPointerPosition()
    const newStroke = { points: [pos.x, pos.y], tension: 0.5 }
    lastStrokeRef.current = newStroke

    setDrawing(prev => [...prev, newStroke])
  }

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || !isDrawingEnabled || drawing.length === 0) return
  
    const stage = e.target.getStage()
    const point = stage.getPointerPosition()

    setDrawing(prevDrawing => {
      const lastStroke = prevDrawing[prevDrawing.length - 1]
      if (!lastStroke) return prevDrawing

      const updatedStroke = { ...lastStroke, points: [...lastStroke.points, point.x, point.y] }
      lastStrokeRef.current = updatedStroke

      return [...prevDrawing.slice(0, -1), updatedStroke]
    })
  }

  const handleMouseUp = () => {
    if (!isDrawing.current || hasSentStrokeRef.current) return 

    isDrawing.current = false
    hasSentStrokeRef.current = true 

    if (username && lastStrokeRef.current) {
      SignalingManager.getInstance(username).sendMessage({ 
        type: "DRAWING", 
        drawing_data: lastStrokeRef.current 
      })
    }
  }

  return (
    <div className="bg-white rounded-lg overflow-hidden border-solid border-gray-600 border-x-2 border-y-2">
      <Stage
        width={800}
        height={500}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} 
      >
        <Layer>
          {drawing.map((drawingStroke: DrawingStroke, i: number) => (
            <Line
              key={i}
              points={drawingStroke.points}
              stroke="black"
              strokeWidth={3}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
