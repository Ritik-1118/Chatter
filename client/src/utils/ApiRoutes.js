// export const HOST = "http://localhost:8000";
export const HOST = "https://chatter-zdsf.onrender.com";
const AUTH_ROUTE = `${HOST}/api/auth`;
const MESSAGES_ROUTE = `${HOST}/api/messages`;
const GROUPS_ROUTE = `${HOST}/api/groups`;

export const CHECK_USER_ROUTE =  `${AUTH_ROUTE}/check-user`;
export const ONBOARD_USER_ROUTE = `${AUTH_ROUTE}/onboard-user`;
export const GET_ALL_CONTACTS = `${AUTH_ROUTE}/get-contacts`;
export const GET_CALL_TOKEN = `${AUTH_ROUTE}//generate-token`;

export const ADD_MESSAGE_ROUTE = `${MESSAGES_ROUTE}/add-message`;
export const GET_MESSAGES_ROUTE = `${MESSAGES_ROUTE}/get-messages`;
export const ADD_IMAGE_MESSAGE_ROUTE = `${MESSAGES_ROUTE}/add-image-message`;
export const ADD_AUDIO_MESSAGE_ROUTE = `${MESSAGES_ROUTE}/add-audio-message`;
export const GET_INITIAL_CONTACTS_RIUTE = `${MESSAGES_ROUTE}/get-initial-contacts`;

export const CREATE_GROUP_ROUTE = `${GROUPS_ROUTE}/create-group`;
export const GET_USER_GROUPS_ROUTE = `${GROUPS_ROUTE}/get-user-groups`;
export const GET_GROUP_MEMBERS_ROUTE = `${GROUPS_ROUTE}/get-group-members`;
export const ADD_GROUP_MEMBER_ROUTE = `${GROUPS_ROUTE}/add-group-member`;
export const ADD_GROUP_MESSAGE_ROUTE = `${MESSAGES_ROUTE}/add-group-message`;
export const GET_GROUP_MESSAGES_ROUTE = `${MESSAGES_ROUTE}/get-group-messages`;