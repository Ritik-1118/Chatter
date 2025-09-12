import React, { useState } from 'react';
import { useStateProvider } from '@/context/StateContext';
import { useTheme } from '@/context/ThemeContext';
import Avatar from './Avatar';
import { CREATE_GROUP_ROUTE } from '@/utils/ApiRoutes';
import axios from 'axios';
import { reducerCases } from '@/context/constants';

function CreateGroupModal({ setShowCreateGroupModal }) {
    const { theme } = useTheme();
    const [{ userInfo, userContacts }, dispatch] = useStateProvider();
    const [groupName, setGroupName] = useState('');
    const [selectedContacts, setSelectedContacts] = useState([]);

    const handleContactSelect = (contactId) => {
        if (selectedContacts.includes(contactId)) {
            setSelectedContacts(selectedContacts.filter((id) => id !== contactId));
        } else {
            setSelectedContacts([...selectedContacts, contactId]);
        }
    };

    const createGroup = async () => {
        try {
            const { data } = await axios.post(CREATE_GROUP_ROUTE, {
                name: groupName,
                members: [...selectedContacts, userInfo.id],
                admin: userInfo.id,
            });
            setShowCreateGroupModal(false);
            dispatch({ type: reducerCases.ADD_USER_GROUP, newGroup: data.group });
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className={`${theme === 'dark' ? 'bg-dark-surface' : 'bg-light-surface'} rounded-lg p-6 w-full max-w-md`}>
                <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}`}>Create Group</h2>
                <input
                    type="text"
                    placeholder="Group Name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className={`w-full p-2 mb-4 rounded ${theme === 'dark' ? 'bg-dark-secondary-background text-dark-primary-text' : 'bg-light-secondary-background text-light-primary-text'}`}
                />
                <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}`}>Select Members</h3>
                <div className="flex flex-col gap-4 max-h-64 overflow-y-auto custom-scrollbar">
                    {userContacts.map((contact) => (
                        <div
                            key={contact.id}
                            className={`flex items-center justify-between p-2 rounded cursor-pointer ${selectedContacts.includes(contact.id) ? (theme === 'dark' ? 'bg-dark-accent' : 'bg-light-accent') : ''}`}
                            onClick={() => handleContactSelect(contact.id)}
                        >
                            <div className="flex items-center gap-4">
                                <Avatar type="sm" image={contact.profilePicture} />
                                <span className={`${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}`}>{contact.name}</span>
                            </div>
                            <input type="checkbox" checked={selectedContacts.includes(contact.id)} readOnly />
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button
                        className="px-4 py-2 rounded bg-gray-500 text-white"
                        onClick={() => setShowCreateGroupModal(false)}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-2 rounded bg-green-500 text-white"
                        onClick={createGroup}
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateGroupModal;
