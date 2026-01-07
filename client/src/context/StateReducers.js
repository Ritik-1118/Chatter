import { reducerCases } from "./constants";

export const initialState = {
    userInfo: undefined,
    newUser: false,
    contactsPage: false,
    currentChatUser:undefined,
    messages: [],
    messagesByChat: {},
    socketStatus: "disconnected",
    socket: undefined,
    messagesSearch:false,
    userContacts: [],
    onlineUsers: [],
    filteredContacts: [],
    smWindows: false,
    showSmChatList:false,
    
    videoCall:undefined,
    voiceCall:undefined,
    incomingVideoCall:undefined,
    incomingVoiceCall:undefined,
};

const reducer = (state,action)=>{
    switch (action.type){
        case reducerCases.SET_USER_INFO:{
            console.log({userInfo: action.userInfo});
            return {
                ...state,
                userInfo: action.userInfo,
            };
        }
            case reducerCases.SET_NEW_USER:
                return{
                    ...state,
                    newUser: action.newUser,
                };
            case reducerCases.SET_ALL_CONTACTS_PAGE:
                return {
                    ...state,
                    contactsPage: !state.contactsPage,
                };
            case reducerCases.CHANGE_CURRENT_CHAT_USER:
                return {
                    ...state,
                    currentChatUser: action.user,
                    messages: state.messagesByChat?.[action.user?._id] || [],
                };
            case reducerCases.SET_MESSAGES:
                if (!action.chatId) return state;
                {
                    const updatedMessagesByChat = {
                        ...state.messagesByChat,
                        [action.chatId]: action.messages,
                    };
                    return {
                        ...state,
                        messagesByChat: updatedMessagesByChat,
                        messages:
                            state.currentChatUser && state.currentChatUser._id === action.chatId
                                ? action.messages
                                : state.messages,
                    };
                }
            case reducerCases.UPSERT_MESSAGE: {
                const { chatId, message, tempId } = action;
                if (!chatId || !message) return state;

                const existing = state.messagesByChat[chatId] || [];
                const findIndex = (msg) =>
                    msg._id === message._id ||
                    (tempId && msg._id === tempId) ||
                    (message.tempId && msg.tempId && msg.tempId === message.tempId);
                const idx = existing.findIndex(findIndex);
                const updatedForChat = idx > -1
                    ? existing.map((m, i) => (i === idx ? { ...m, ...message, _id: message._id || m._id } : m))
                    : [...existing, message];

                const partnerId = message.sender === state.userInfo?.id
                    ? (message.receiver || message.to)
                    : message.sender;
                const userContacts = state.userContacts || [];
                const contactIndex = userContacts.findIndex(
                    (c) => c._id === partnerId || c.id === partnerId
                );
                const updatedContacts = contactIndex > -1
                    ? userContacts.map((c, i) => i === contactIndex
                        ? {
                            ...c,
                            message: message.message,
                            type: message.type || "text",
                            messageStatus: message.messageStatus || c.messageStatus,
                        }
                        : c)
                    : userContacts;

                return {
                    ...state,
                    userContacts: updatedContacts,
                    messagesByChat: {
                        ...state.messagesByChat,
                        [chatId]: updatedForChat,
                    },
                    messages:
                        state.currentChatUser && state.currentChatUser._id === chatId
                            ? updatedForChat
                            : state.messages,
                };
            }
            case reducerCases.SET_SOCKET:
                return {
                    ...state,
                    socket: action.socket,
                };
            case reducerCases.ADD_MESSAGE: {
                const { chatId, newMessage } = action;
                if (!chatId || !newMessage) return state;
                const existing = state.messagesByChat[chatId] || [];
                const updatedForChat = [...existing, newMessage];
                return {
                    ...state,
                    messagesByChat: {
                        ...state.messagesByChat,
                        [chatId]: updatedForChat,
                    },
                    messages:
                        state.currentChatUser && state.currentChatUser._id === chatId
                            ? updatedForChat
                            : state.messages,
                };
            }
            case reducerCases.SET_SOCKET_STATUS:
                return {
                    ...state,
                    socketStatus: action.status,
                };
            case reducerCases.SET_MESSAGE_SEARCH:
                return {
                    ...state,
                    messagesSearch: !state.messagesSearch,
                };
            case reducerCases.SET_USER_CONTACTS:
                return {
                    ...state,
                    userContacts:action.userContacts,
                }
            case reducerCases.SET_ONLINE_USERS:
                return {
                    ...state,
                    onlineUsers: action.onlineUsers,
                };
            case reducerCases.SET_CONTACT_SEARCH:
                const filteredContacts = state.userContacts.filter((contact)=> 
                    contact.name.toLowerCase().includes(action.contactSearch.toLowerCase())
                );
                return {
                    ...state,
                    contactSearch: action.contactSearch,
                    filteredContacts,
                };
            
            case reducerCases.SET_SM_WINDOWS_TRUE:
                return {
                    ...state,
                    smWindows:action.smWindows,
                }
            case reducerCases.SET_SHOW_SM_CHATLIST:
                return {
                    ...state,
                    showSmChatList:action.showSmChatList,
                }

            case reducerCases.SET_VIDEO_CALL:
                return {
                    ...state,
                    videoCall:action.videoCall,
                };
            case reducerCases.SET_VOICE_CALL:
                return {
                    ...state,
                    voiceCall:action.voiceCall,
                };
            case reducerCases.SET_INCOMING_VIDEO_CALL:
                return {
                    ...state,
                    incomingVideoCall:action.incomingVideoCall,
                };
            case reducerCases.SET_INCOMING_VOICE_CALL:
                return {
                    ...state,
                    incomingVoiceCall:action.incomingVoiceCall,
                };
            case reducerCases.END_CALL:
                return {
                    ...state,
                    videoCall:undefined,
                    voiceCall:undefined,
                    incomingVideoCall:undefined,
                    incomingVoiceCall:undefined,
                };

            case reducerCases.SET_EXIT_CHAT:
                return{
                    ...state,
                    currentChatUser:undefined,
                }

            case reducerCases.UPDATE_CONTACT_PREVIEW: {
                const { message } = action;
                const userContacts = state.userContacts || [];
                const contactIndex = userContacts.findIndex(
                    (c) => c._id === message.sender || c.id === message.sender
                );
                if (contactIndex === -1) return state;
                const updatedContacts = [...userContacts];
                updatedContacts[contactIndex] = {
                    ...updatedContacts[contactIndex],
                    message: message.message,
                    type: message.type || "text",
                };
                return {
                    ...state,
                    userContacts: updatedContacts,
                };
            }

            case reducerCases.BULK_UPDATE_MESSAGE_STATUS: {
                const { ids = [], status } = action;
                if (!status || !Array.isArray(ids) || !ids.length) return state;
                const updateList = (list = []) =>
                    list.map((msg) => (ids.includes(msg._id) ? { ...msg, messageStatus: status } : msg));

                const updatedMessagesByChat = Object.entries(state.messagesByChat || {}).reduce(
                    (acc, [chatId, list]) => ({
                        ...acc,
                        [chatId]: updateList(list),
                    }),
                    {}
                );

                return {
                    ...state,
                    messagesByChat: updatedMessagesByChat,
                    messages: updateList(state.messages),
                };
            }
        default:
            return state;
    }
};

export default reducer;