export interface Participant {
    name: string
    score: number
}
  
  interface ParticipantsProps {
    participants: Participant[],
  }
  
  export default function Participants({ participants }: ParticipantsProps) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Participants</h2>
        <div className="flex flex-wrap gap-4">
          {participants.map((participant, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg "bg-gray-100"
               shadow-sm`}
            >
              <span className="text-gray-900 font-medium">{participant.name}</span>
              <span className="text-sm text-gray-600">Score: {participant.score}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }