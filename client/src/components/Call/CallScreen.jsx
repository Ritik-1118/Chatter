import { useEffect, useRef, useState } from "react";
import { BsCameraVideo, BsCameraVideoOff, BsMic, BsMicMute } from "react-icons/bs";
import { MdCallEnd } from "react-icons/md";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/media";
import { emit, getSocket } from "@/lib/socket";
import Avatar from "../common/Avatar";
import IconButton from "../common/IconButton";

const defaultServer = (appId) => [`wss://webliveroom${appId}-api.zego.im/ws`, `wss://webliveroom${appId}-api-bak.zego.im/ws`];

export default function CallScreen() {
    const [{ call, userInfo }, dispatch] = useStateProvider();
    const toast = useToast();
    const remoteVideo = useRef(null);
    const remoteAudio = useRef(null);
    const localVideo = useRef(null);
    const engine = useRef(null);
    const [connected, setConnected] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [muted, setMuted] = useState(false);
    const [cameraOff, setCameraOff] = useState(false);
    const isVideo = call?.callType === "video";

    // Ring the other side once.
    useEffect(() => {
        if (call?.direction !== "outgoing") return;
        getSocket()?.emit(`outgoing-${call.callType}-call`, { to: call.peer.id, roomId: call.roomId, callType: call.callType });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Media starts once both sides have agreed to the call.
    useEffect(() => {
        if (!call?.accepted) return undefined;
        let cancelled = false;
        const session = { zg: null, local: null, publishId: null, playing: [] };
        engine.current = session;

        (async () => {
            try {
                const { token, appId, serverUrl } = await api.callToken();
                const { ZegoExpressEngine } = await import("zego-express-engine-webrtc");
                if (cancelled) return;
                const zg = new ZegoExpressEngine(appId, serverUrl || defaultServer(appId));
                session.zg = zg;
                zg.on("roomStreamUpdate", async (_room, updateType, streamList) => {
                    if (updateType === "ADD") {
                        for (const s of streamList) {
                            const remote = await zg.startPlayingStream(s.streamID, { audio: true, video: isVideo });
                            session.playing.push(s.streamID);
                            const el = isVideo ? remoteVideo.current : remoteAudio.current;
                            if (el) el.srcObject = remote;
                            setConnected(true);
                        }
                    } else if (updateType === "DELETE") {
                        hangUp();
                    }
                });
                await zg.loginRoom(String(call.roomId), token, { userID: String(userInfo.id), userName: userInfo.name }, { userUpdate: true });
                const local = await zg.createStream({ camera: { audio: true, video: isVideo } });
                session.local = local;
                if (isVideo && localVideo.current) localVideo.current.srcObject = local;
                session.publishId = `${call.roomId}-${userInfo.id}`;
                zg.startPublishingStream(session.publishId, local);
            } catch (err) {
                if (cancelled) return;
                toast(err?.status === 503 ? "Calling isn't available on this server" : "Couldn't start the call", { type: "error" });
                hangUp();
            }
        })();

        return () => {
            cancelled = true;
            const { zg, local, publishId, playing } = session;
            try {
                playing.forEach((id) => zg?.stopPlayingStream(id));
                if (publishId) zg?.stopPublishingStream(publishId);
                if (local) zg?.destroyStream(local);
                zg?.logoutRoom(String(call.roomId));
                zg?.destroyEngine();
            } catch {
                /* engine already gone */
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [call?.accepted, call?.roomId]);

    useEffect(() => {
        if (!connected) return undefined;
        const t = setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, [connected]);

    function hangUp() {
        emit(`reject-${call.callType}-call`, { from: call.peer.id });
        dispatch({ type: reducerCases.END_CALL });
    }

    const toggleMute = () => {
        const { zg, local } = engine.current || {};
        if (zg && local) zg.mutePublishStreamAudio(local, !muted);
        setMuted(!muted);
    };
    const toggleCamera = () => {
        const { zg, local } = engine.current || {};
        if (zg && local) zg.mutePublishStreamVideo(local, !cameraOff);
        setCameraOff(!cameraOff);
    };

    if (!call) return null;
    const status = !call.accepted ? "Calling…" : connected ? formatDuration(seconds) : "Connecting…";

    return (
        <main
            aria-label={`${isVideo ? "Video" : "Voice"} call with ${call.peer.name}`}
            className="relative flex h-screen w-screen flex-col items-center justify-between overflow-hidden bg-dark-background py-12 text-white"
        >
            {isVideo && <video ref={remoteVideo} autoPlay playsInline className={`absolute inset-0 h-full w-full object-cover ${connected ? "" : "hidden"}`} />}
            <audio ref={remoteAudio} autoPlay />
            <div className="relative z-10 flex flex-col items-center gap-3">
                {!(isVideo && connected) && <Avatar type="xl" image={call.peer.profilePicture} alt="" />}
                <h1 className="text-3xl font-semibold sm:text-5xl">{call.peer.name}</h1>
                <p className="text-lg" role="status">
                    {status}
                </p>
            </div>
            {isVideo && (
                <video ref={localVideo} autoPlay playsInline muted className="absolute bottom-28 right-4 z-10 h-36 w-28 rounded-lg bg-black object-cover shadow-lg sm:h-44 sm:w-32" />
            )}
            <div className="relative z-10 flex items-center gap-6">
                <IconButton label={muted ? "Unmute" : "Mute"} onClick={toggleMute} className="h-14 w-14 bg-white/10 text-2xl">
                    {muted ? <BsMicMute aria-hidden="true" /> : <BsMic aria-hidden="true" />}
                </IconButton>
                {isVideo && (
                    <IconButton label={cameraOff ? "Turn camera on" : "Turn camera off"} onClick={toggleCamera} className="h-14 w-14 bg-white/10 text-2xl">
                        {cameraOff ? <BsCameraVideoOff aria-hidden="true" /> : <BsCameraVideo aria-hidden="true" />}
                    </IconButton>
                )}
                <IconButton label="End call" onClick={hangUp} className="h-16 w-16 bg-red-600 text-3xl hover:bg-red-700">
                    <MdCallEnd aria-hidden="true" />
                </IconButton>
            </div>
        </main>
    );
}
