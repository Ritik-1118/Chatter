import { MdCall, MdCallEnd } from "react-icons/md";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { stopRingtone } from "@/lib/notifications";
import { emit } from "@/lib/socket";
import Avatar from "../common/Avatar";

export default function IncomingCall() {
    const [{ incomingCall }, dispatch] = useStateProvider();
    if (!incomingCall) return null;
    const { peer, callType, roomId } = incomingCall;

    const accept = () => {
        stopRingtone();
        emit("accept-incoming-call", { id: peer.id });
        dispatch({ type: reducerCases.SET_CALL, call: { direction: "incoming", callType, peer, roomId, accepted: true } });
        dispatch({ type: reducerCases.SET_INCOMING_CALL, incomingCall: null });
    };
    const decline = () => {
        stopRingtone();
        emit(`reject-${callType}-call`, { from: peer.id });
        dispatch({ type: reducerCases.END_CALL });
    };

    return (
        <div
            role="alertdialog"
            aria-label={`Incoming ${callType} call from ${peer.name}`}
            className="fixed bottom-6 right-6 z-[85] flex w-80 items-center gap-4 rounded-xl border-2 border-unread bg-light-secondary-background p-4 text-light-primary-text shadow-2xl dark:bg-dark-secondary-background dark:text-dark-primary-text"
        >
            <Avatar type="lg" image={peer.profilePicture} alt="" />
            <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{peer.name}</div>
                <div className="text-xs text-light-secondary-text dark:text-dark-secondary-text">Incoming {callType} call</div>
                <div className="mt-2 flex gap-2">
                    <button type="button" onClick={decline} className="flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-sm text-white">
                        <MdCallEnd aria-hidden="true" /> Decline
                    </button>
                    <button type="button" onClick={accept} className="flex items-center gap-1 rounded-full bg-unread px-3 py-1 text-sm text-white">
                        <MdCall aria-hidden="true" /> Accept
                    </button>
                </div>
            </div>
        </div>
    );
}
