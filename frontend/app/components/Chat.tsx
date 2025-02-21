"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface Message {
  name: string
  message: string
}

interface ChatProps {
  messages: Message[]
  onSendMessage: (message: string) => void
}

export default function Chat({ messages, onSendMessage }: ChatProps) {
    const [newMessage, setNewMessage] = useState("")
  
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (newMessage.trim()) {
        onSendMessage(newMessage)
        setNewMessage("")
      }
    }
  
    return (
      <div className="flex flex-col h-full bg-gray-100 rounded-lg">
        <div className="p-3 border-b border-gray-300">
          <h2 className="text-lg font-semibold text-black">Chat</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div key={index} className="bg-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-black">{message.name}</span>
              </div>
              <p className="text-gray-700 mt-1">{message.message}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-300">
          <div className="flex gap-2">
            <Input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="bg-white border-gray-300 text-black"
            />
            <Button type="submit" className="bg-blue-500 text-white">Send</Button>
          </div>
        </form>
      </div>
    )
  }

