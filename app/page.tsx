"use client"
import React, { useEffect } from 'react';
import { useSocketContext } from './context/SocketContext'; 


export default function Home() {
    const { remoteVideos, localVideoRef, usernameRef } = useSocketContext();

    useEffect(() => {
        console.log(remoteVideos);
    }, [remoteVideos]);


    return (
        <div>
            <input ref={usernameRef} type="text" placeholder="Enter your username" />
            <div className="max-w-sm rounded-sm overflow-hidden shadow-sm bg-white">
                <video ref={localVideoRef} autoPlay muted/>
            </div>
            <div id="remote-videos">
            {Object.entries(remoteVideos).map(([key, videoElement]) => (
                <div key={key} className="max-w-sm rounded-sm overflow-hidden shadow-sm bg-red-500">
                    <video
                    ref={(ref) => {
                        if (ref && videoElement.srcObject) {
                            ref.srcObject = videoElement.srcObject;
                        }
                    }}
                    autoPlay
                    playsInline

                    />
                </div>
            ))}
            </div>
        </div>
    );
}
