"use client"
import { ArrowRightEndOnRectangleIcon, MicrophoneIcon, PhoneArrowUpRightIcon, VideoCameraIcon, VideoCameraSlashIcon } from "@heroicons/react/24/outline";
import { useGlobalContext } from "../context/GlobalContext";
import { useEffect, useState } from "react";
import { useSocketContext } from "../context/SocketContext";

const BottomMenu = () => {
    const [isStart, setStart] = useState(false);
    const { myMic, myVideo, setMyMic, setMyVideo } = useGlobalContext();
    const { socket, startCall, stopCall, isCallActive, usernameRef } = useSocketContext();

    useEffect(() => {
      if (socket) {
        console.log('Socket connected:', socket.id);
      }
    }, [socket]);

    const updateMic = () => {
        setMyMic(!myMic);
    };

    const updateVideo = () => {
        setMyVideo(!myVideo);
    };

    const outGroup = () =>{
        stopCall()
        setStart(isCallActive.current);
    }

    const handleStartCall = async () => {
        const username = usernameRef.current?.value;
        if (username) {
            await startCall(username);
        }
        setStart(isCallActive.current);
    };

    return (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-gray-800 p-4 rounded-full shadow-lg flex space-x-4">
            {!isStart ?
            <span className="text-white hover:text-gray-300 cursor-pointer iconOuts" id="iconOut">
                 <PhoneArrowUpRightIcon className="w-6 h-6" onClick={handleStartCall} /> 
            </span>
            : "" }
            <span className={` ${myMic ? "text-red-500": "text-white"} hover:text-gray-300 cursor-pointer iconMics`} id="iconMic" onClick={updateMic}>
                <MicrophoneIcon className="w-6 h-6" />
            </span>
            <span className="text-white hover:text-gray-300 cursor-pointer iconVideos" id="iconVideo" onClick={updateVideo}>
                {myVideo ? <VideoCameraIcon className="w-6 h-6" />: <VideoCameraSlashIcon className="w-6 h-6" />}
            </span>
            {isStart ?
            <span className="text-white hover:text-gray-300 cursor-pointer iconOuts" id="iconOut">
                 <ArrowRightEndOnRectangleIcon className="w-6 h-6" onClick={outGroup} /> 
            </span>
            : "" } 
        </div>
    );
};

export default BottomMenu;
