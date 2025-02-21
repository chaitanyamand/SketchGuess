import Link from "next/link"
import { Pencil, Users, Clock, Trophy } from "lucide-react"

export default function Landing() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        <section className="w-full pt-12 bg-gradient-to-b from-primary/20 to-background">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Welcome to SketchGuess!
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                  The most fun you can have with a digital pencil! Draw, guess, and laugh with friends in this exciting
                  online pictionary game.
                </p>
              </div>
              <button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/home">Start Playing!</Link>
              </button>
            </div>
          </div>
        </section>
        <section className="w-full md:py-24">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">Why SketchGuess?</h2>
            <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
              <div className="flex flex-col items-center space-y-2 border-gray-800 p-4 rounded-lg">
                <Pencil className="h-12 w-12 text-primary" />
                <h3 className="text-xl font-bold">Easy Drawing Tools</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Simple yet powerful drawing tools at your fingertips.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 border-gray-800 p-4 rounded-lg">
                <Users className="h-12 w-12 text-primary" />
                <h3 className="text-xl font-bold">Multiplayer Fun</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Play with friends or make new ones online.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 border-gray-800 p-4 rounded-lg">
                <Clock className="h-12 w-12 text-primary" />
                <h3 className="text-xl font-bold">Quick Rounds</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Fast-paced gameplay keeps the excitement going.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 border-gray-800 p-4 rounded-lg">
                <Trophy className="h-12 w-12 text-primary" />
                <h3 className="text-xl font-bold">Leaderboards</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Compete for the top spot and show off your skills.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className=" gap-2  py-6 w-full  px-4 md:px-6 border-t">
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">© 2025 SketchGuess. All rights reserved.</p>
      </footer>
    </div>
  )
}

