import { reducerCases } from "./constants";

export const initialState = {
    userInfo: undefined,
    newUser: false,
    contactsPage: false,
    currentChatUser:undefined,
    messages: [],
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
                };
            case reducerCases.SET_MESSAGES:
                return {
                    ...state,
                    messages: action.messages,
                };
            case reducerCases.SET_SOCKET:
                return {
                    ...state,
                    socket: action.socket,
                };
            case reducerCases.ADD_MESSAGE:
                return {
                    ...state,
                    messages:[...state.messages,action.newMessage],
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
                const updatedMessages = state.messages.map((msg) =>
                    ids.includes(msg._id) ? { ...msg, messageStatus: status } : msg
                );
                return {
                    ...state,
                    messages: updatedMessages,
                };
            }
        default:
            return state;
    }
};

export default reducer;