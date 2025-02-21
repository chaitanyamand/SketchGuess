"use client"

import { useEffect } from "react";
import Home from "../components/Home"
import { SignalingManager } from "../utils/SignalingManager"

function HomePage() {
  useEffect(()=> {  
    const storageObject = localStorage.getItem("sketchguess");
      if(storageObject) {
        const parsedStorageObject = JSON.parse(storageObject as string);
      if(parsedStorageObject.username)
      {
        const username = parsedStorageObject.username
        SignalingManager.getInstance(username).terminateConnection();
      }
    }
    localStorage.removeItem("sketchguess");
  },[])

  return (
    <Home/>
  )
}

export default HomePage