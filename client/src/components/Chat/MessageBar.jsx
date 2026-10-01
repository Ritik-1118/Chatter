import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { BsEmojiSmile } from "react-icons/bs";
import { FaMicrophone } from "react-icons/fa";
import { ImAttachment } from "react-icons/im";
import { IoClose } from "react-icons/io5";
import { MdSend } from "react-icons/md";
import { reducerCases } from "@/context/constants";
import { useSettings } from "@/context/SettingsContext";
import { useStateProvider } from "@/context/StateContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { IMAGE_TYPES, LIMITS } from "@/lib/media";
import { sendOutgoing } from "@/lib/outbox";
import { emit } from "@/lib/socket";
import ContextMenu from "../common/ContextMenu";
import IconButton from "../common/IconButton";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
const CaptureAudio = dynamic(() => import("./CaptureAudio"), { ssr: false });

const MAX_LENGTH = 4000;
const TYPING_INTERVAL_MS = 3000;

export default function MessageBar({ chat }) {
    const [{ userInfo, replyTo, editing }, dispatch] = useStateProvider();
    const { settings } = useSettings();
    const { theme } = useTheme();
    const toast = useToast();
    const [message, setMessage] = useState("");
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [attachOpen, setAttachOpen] = useState(false);
    const [recording, setRecording] = useState(false);
    const textarea = useRef(null);
    const attachButton = useRef(null);
    const emojiPanel = useRef(null);
    const imageInput = useRef(null);
    const fileInput = useRef(null);
    const sending = useRef(false);
    const typingSentAt = useRef(0);
    const stopTimer = useRef(null);
    const reply = replyTo[chat.id];
    const edit = editing[chat.id];
    const me = userInfo?.id;
    const target = chat.isGroup ? { conversationId: chat.id } : { conversationId: chat.id, to: chat.partnerId };

    const stopTyping = useCallback(() => {
        clearTimeout(stopTimer.current);
        if (typingSentAt.current) emit("stop-typing", target);
        typingSentAt.current = 0;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chat.id]);

    // Remounted per chat (keyed by chat id), so this runs once per conversation.
    useEffect(() => {
        textarea.current?.focus();
        return stopTyping;
    }, [stopTyping]);

    // Starting an edit loads the message into the input.
    const [editShown, setEditShown] = useState(edit);
    if (edit !== editShown) {
        setEditShown(edit);
        if (edit) setMessage(edit.message);
    }
    useEffect(() => {
        if (edit) textarea.current?.focus();
    }, [edit]);

    useEffect(() => {
        if (!emojiOpen) return undefined;
        const close = (e) => !emojiPanel.current?.contains(e.target) && setEmojiOpen(false);
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [emojiOpen]);

    useEffect(() => {
        const el = textarea.current;
        if (!el) return;
        el.style.height = "40px";
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, [message]);

    const onChange = (e) => {
        setMessage(e.target.value);
        const now = Date.now();
        if (now - typingSentAt.current > TYPING_INTERVAL_MS) {
            emit("typing", target);
            typingSentAt.current = now;
        }
        clearTimeout(stopTimer.current);
        stopTimer.current = setTimeout(stopTyping, 4000);
    };

    const onError = (err) => toast(err.message, { type: "error" });

    const submit = async () => {
        const text = message.trim();
        if (!text || sending.current) return;
        if (text.length > MAX_LENGTH) return toast(`Messages can be at most ${MAX_LENGTH} characters`, { type: "error" });
        sending.current = true;
        stopTyping();
        try {
            if (edit) {
                const { message: updated } = await api.editMessage(edit._id, text);
                dispatch({ type: reducerCases.UPDATE_MESSAGE, message: updated });
                dispatch({ type: reducerCases.SET_EDITING, chatId: chat.id, message: null });
                setMessage("");
                return;
            }
            // Clear immediately so a second Enter press cannot resend the same text.
            setMessage("");
            dispatch({ type: reducerCases.SET_REPLY, chatId: chat.id, message: null });
            sending.current = false;
            await sendOutgoing(dispatch, { chatId: chat.id, me, payload: { kind: "text", text, replyTo: reply }, onError });
        } catch (err) {
            onError(err);
        } finally {
            sending.current = false;
        }
    };

    const onKeyDown = (e) => {
        if (e.key === "Escape" && (reply || edit)) {
            dispatch({ type: edit ? reducerCases.SET_EDITING : reducerCases.SET_REPLY, chatId: chat.id, message: null });
            if (edit) setMessage("");
            return;
        }
        if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
        if (e.ctrlKey || e.metaKey || (settings.enterToSend && !e.shiftKey)) {
            e.preventDefault();
            submit();
        }
    };

    const sendFile = (kind) => (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (kind === "image" && !IMAGE_TYPES.includes(file.type)) return toast("Please choose a PNG, JPEG, WebP or GIF image", { type: "error" });
        if (file.size > LIMITS[kind]) return toast(`That file is too large (max ${LIMITS[kind] / 1024 / 1024} MB)`, { type: "error" });
        dispatch({ type: reducerCases.SET_REPLY, chatId: chat.id, message: null });
        sendOutgoing(dispatch, { chatId: chat.id, me, payload: { kind, file, replyTo: reply }, onError });
    };

    if (chat.blocked) {
        return (
            <div className="flex items-center justify-center gap-3 bg-light-secondary-background p-4 text-sm text-light-secondary-text dark:bg-dark-secondary-background dark:text-dark-secondary-text">
                You blocked this contact.
                <button
                    type="button"
                    className="font-semibold text-light-accent dark:text-dark-accent"
                    onClick={async () => {
                        try {
                            await api.unblock(chat.partnerId);
                            dispatch({ type: reducerCases.SET_BLOCKED, userId: chat.partnerId, blocked: false });
                        } catch (err) {
                            onError(err);
                        }
                    }}
                >
                    Unblock
                </button>
            </div>
        );
    }

    if (recording) {
        return (
            <div className="bg-light-secondary-background px-4 py-3 dark:bg-dark-secondary-background">
                <CaptureAudio
                    onClose={() => setRecording(false)}
                    onSend={(file) => sendOutgoing(dispatch, { chatId: chat.id, me, payload: { kind: "audio", file, replyTo: reply }, onError })}
                />
            </div>
        );
    }

    const banner = edit
        ? { title: "Editing message", text: edit.message }
        : reply
          ? { title: reply.sender === me ? "Replying to yourself" : "Replying", text: reply.message || reply.file?.name || "Attachment" }
          : null;
    return (
        <div className="relative bg-light-secondary-background dark:bg-dark-secondary-background">
            {banner && (
                <div className="mx-4 mt-2 flex items-start justify-between gap-2 rounded-md border-l-4 border-light-accent bg-light-surface px-3 py-2 text-sm dark:border-dark-accent dark:bg-dark-surface">
                    <span className="min-w-0">
                        <span className="block text-xs font-semibold text-light-accent dark:text-dark-accent">{banner.title}</span>
                        <span className="line-clamp-1 text-light-secondary-text dark:text-dark-secondary-text">{banner.text}</span>
                    </span>
                    <IconButton
                        label={edit ? "Cancel editing" : "Cancel reply"}
                        className="!p-1 text-base"
                        onClick={() => {
                            dispatch({ type: edit ? reducerCases.SET_EDITING : reducerCases.SET_REPLY, chatId: chat.id, message: null });
                            if (edit) setMessage("");
                        }}
                    >
                        <IoClose aria-hidden="true" />
                    </IconButton>
                </div>
            )}
            <form
                className="flex items-end gap-2 px-2 py-3 sm:gap-3 sm:px-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <div className="flex shrink-0 text-light-secondary-text dark:text-dark-secondary-text">
                    <IconButton label="Insert emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((v) => !v)}>
                        <BsEmojiSmile aria-hidden="true" />
                    </IconButton>
                    {!edit && (
                        <IconButton ref={attachButton} label="Attach" aria-haspopup="menu" aria-expanded={attachOpen} onClick={() => setAttachOpen((v) => !v)}>
                            <ImAttachment aria-hidden="true" />
                        </IconButton>
                    )}
                </div>
                {emojiOpen && (
                    <div ref={emojiPanel} className="absolute bottom-20 left-2 z-40">
                        <EmojiPicker theme={theme} onEmojiClick={(emoji) => setMessage((m) => m + emoji.emoji)} lazyLoadEmojis />
                    </div>
                )}
                {attachOpen && (
                    <ContextMenu
                        label="Attach"
                        anchorRef={attachButton}
                        align="left"
                        onClose={() => setAttachOpen(false)}
                        options={[
                            { name: "Photo", callback: () => imageInput.current?.click() },
                            { name: "Document", callback: () => fileInput.current?.click() },
                        ]}
                    />
                )}
                <input ref={imageInput} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={sendFile("image")} data-testid="image-input" />
                <input ref={fileInput} type="file" hidden onChange={sendFile("file")} data-testid="file-input" />
                <textarea
                    id="message-box"
                    ref={textarea}
                    rows={1}
                    value={message}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    onBlur={stopTyping}
                    maxLength={MAX_LENGTH}
                    placeholder="Type a message"
                    aria-label="Message input"
                    className="max-h-[120px] min-h-[40px] w-full resize-none rounded-lg bg-light-surface px-4 py-2 text-sm leading-6 text-light-primary-text focus:outline-none focus-visible:ring-2 focus-visible:ring-light-accent dark:bg-dark-surface dark:text-dark-primary-text dark:focus-visible:ring-dark-accent"
                />
                <div className="shrink-0 text-light-accent dark:text-dark-accent">
                    {message.trim() || edit ? (
                        <IconButton type="submit" label={edit ? "Save edit" : "Send message"}>
                            <MdSend aria-hidden="true" />
                        </IconButton>
                    ) : (
                        <IconButton label="Record audio message" onClick={() => setRecording(true)}>
                            <FaMicrophone aria-hidden="true" />
                        </IconButton>
                    )}
                </div>
            </form>
        </div>
    );
}
