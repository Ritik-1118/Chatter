import { reducerCases } from "@/context/constants";
import { api } from "./api";

let counter = 0;
export const newTempId = () => `temp-${Date.now()}-${++counter}`;

const replyPreview = (m) =>
    m ? { _id: m._id, id: m._id, sender: m.sender, type: m.type, message: m.type === "text" ? m.message : m.file?.name || "", deleted: m.deleted } : null;

// Sends a message optimistically: it appears at once as "pending", is replaced by the
// server copy on success, or marked "failed" (with what is needed to retry) on error.
// payload: { kind: "text" | "image" | "audio" | "file", text?, file?, replyTo?, tempId? }
export async function sendOutgoing(dispatch, { chatId, me, payload, onError }) {
    const tempId = payload.tempId || newTempId();
    const isText = payload.kind === "text";
    const base = {
        _id: tempId,
        tempId,
        conversationId: chatId,
        sender: me,
        type: payload.kind,
        message: isText ? payload.text : "",
        mediaUrl: !isText && payload.file ? URL.createObjectURL(payload.file) : null,
        file: !isText && payload.file ? { name: payload.file.name, size: payload.file.size, mime: payload.file.type } : null,
        replyTo: replyPreview(payload.replyTo),
        reactions: [],
        createdAt: new Date().toISOString(),
        messageStatus: "pending",
        retry: { ...payload, tempId },
    };
    dispatch({ type: reducerCases.RECEIVE_MESSAGE, message: base, tempId });

    try {
        const fields = { replyTo: payload.replyTo?._id, tempId };
        const { message } = isText
            ? await api.sendText(chatId, { message: payload.text, ...fields })
            : await api.sendMedia(chatId, payload.kind, payload.file, fields, (progress) =>
                  dispatch({ type: reducerCases.RECEIVE_MESSAGE, message: { ...base, progress }, tempId }),
              );
        if (base.mediaUrl) setTimeout(() => URL.revokeObjectURL(base.mediaUrl), 30000);
        dispatch({ type: reducerCases.RECEIVE_MESSAGE, message: { ...message, tempId, retry: undefined, progress: undefined }, tempId });
        return message;
    } catch (err) {
        dispatch({ type: reducerCases.RECEIVE_MESSAGE, message: { ...base, messageStatus: "failed", error: err.message }, tempId });
        onError?.(err);
        return null;
    }
}
