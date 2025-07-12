import { useStateProvider } from "@/context/StateContext";
import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { HOST } from "@/utils/ApiRoutes";
import Avatar from "../common/Avatar";
import { FaPlay, FaStop } from "react-icons/fa";
import { calculateTime } from "@/utils/CalculateTime";
import MessageStatus from "../common/MessageStatus";
import { useTheme } from '@/context/ThemeContext';

function VoiceMessage({message}) {

    const [{currentChatUser,userInfo}] = useStateProvider();
    const { theme } = useTheme();

    const [audioMessage,setAudioMessage] = useState(null);
    const [isPlaying,setIsPlaying] = useState(false);
    const [currentPlaybackTime,setCurrentPlaybackTime] = useState(0);
    const [totalDuration,setTotalDuration] = useState(0);

    const waveformRef = useRef(null);
    const waveform = useRef(null);

    useEffect(()=>{
        if(waveform.current===null) {
            waveform.current = WaveSurfer.create({
                container:waveformRef.current,
                waveColor:"#ccc",
                progressColor:"#4a9eff",
                cursorColor:"#7ae3c3",
                barWidth:2,
                height:30,
                responsive:true,
            });
            waveform.current.on("finish",()=>{
                setIsPlaying(false);
            });
        }
        return () =>{
            waveform.current.destroy();
        };
    },[]);

    useEffect(() => {
        const audioURL = `${HOST}/${message.message}`;
        const audio = new Audio(audioURL);
        setAudioMessage(audio);
        waveform.current.load(audioURL);
        waveform.current.on("ready",()=>{
            setTotalDuration(waveform.current.getDuration());
        })
    },[message.message]);

    useEffect(() => {
        if (audioMessage) {
            const updatePlaybackTime = () => {
                setCurrentPlaybackTime(audioMessage.currentTime);
            }
            audioMessage.addEventListener("timeupdate", updatePlaybackTime);
            return () => {
            audioMessage.removeEventListener("timeupdate", updatePlaybackTime);
            };
        }
    }, [audioMessage]);
    const handlePlayAudio = () =>{
        if (audioMessage){
            waveform.current.stop();
            waveform.current.play();
            audioMessage.play();
            setIsPlaying(true);
        }
    };
    const handlePauseAudio = () =>{
        waveform.current.stop();
        if (audioMessage) {
            audioMessage.pause();
        }
        setIsPlaying(false);
    };

    const formatTime = (time) => {
        if(isNaN(time)) return "00:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;
    };

    return (
        <div className={`flex items-center gap-3 py-2 px-3 rounded-lg w-fit
            ${message.sender === currentChatUser._id 
                ? (theme === 'dark' ? 'bg-dark-bubble-receiver text-dark-primary-text' : 'bg-light-bubble-receiver text-light-primary-text')
                : (theme === 'dark' ? 'bg-dark-bubble-sender text-dark-primary-text' : 'bg-light-bubble-sender text-light-primary-text')}`
        }>
        <div className="flex items-center">
            <div className="left-0">
                {message.sender === userInfo.id ? (
                    <Avatar type="lg" image={userInfo?.profileImage} />
                ) : (
                    <Avatar type="lg" image={currentChatUser?.profilePicture} />
                )}
            </div>
            
            <div className="ml-3 flex flex-col flex-1">
                <div className="flex flex-row-reverse">
                    <div className="text-lg items-center pl-4 mt-2">
                        {!isPlaying ? (
                            <FaPlay onClick={handlePlayAudio} />
                        ) : (
                            <FaStop onClick={handlePauseAudio} />
                        )}
                    </div>
                    <div className="rounded-lg items-center mb-1 w-full">
                        <div className="w-16" ref={waveformRef} />
                    </div>
                </div>
                <div className="flex items-center text-sm">
                    <span className={`mr-2 ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}`}>
                        {formatTime(isPlaying ? currentPlaybackTime : totalDuration)}
                    </span>
                    <div className={`flex items-center text-xs ml-1 ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}`}>
                            <div>{calculateTime(message.createdAt)}</div>
                            <div>
                                {message.sender === userInfo.id && (
                                    <MessageStatus messageStatus={message.messageStatus} />
                                )}
                            </div>
                    </div>
                </div>
            </div>
    </div>
</div>
);

}

export default VoiceMessage;
