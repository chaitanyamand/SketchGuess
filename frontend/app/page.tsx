"use client"
import { useEffect } from "react";
import Landing from "./components/Landing";
import { SignalingManager } from "./utils/SignalingManager";

export default function Home() {
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
    <Landing/>
  );
}
