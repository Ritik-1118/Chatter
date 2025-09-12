import React, { useState } from 'react';
import { useStateProvider } from '@/context/StateContext';
import { useTheme } from '@/context/ThemeContext';
import Avatar from './Avatar';
import { ADD_GROUP_MEMBER_ROUTE } from '@/utils/ApiRoutes';
import axios from 'axios';

function AddGroupMemberModal({ setShowAddGroupMemberModal }) {
    const { theme } = useTheme();
    const [{ userContacts, currentChatUser }] = useStateProvider();
    const [selectedContact, setSelectedContact] = useState(null);

    const addMember = async () => {
        try {
            await axios.post(`${ADD_GROUP_MEMBER_ROUTE}/${currentChatUser._id}`, {
                userId: selectedContact,
            });
            setShowAddGroupMemberModal(false);
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className={`${theme === 'dark' ? 'bg-dark-surface' : 'bg-light-surface'} rounded-lg p-6 w-full max-w-md`}>
                <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}`}>Add Member</h2>
                <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}`}>Select a Contact</h3>
                <div className="flex flex-col gap-4 max-h-64 overflow-y-auto custom-scrollbar">
                    {userContacts.map((contact) => (
                        !currentChatUser.members.includes(contact.id) && (
                            <div
                                key={contact.id}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer ${selectedContact === contact.id ? (theme === 'dark' ? 'bg-dark-accent' : 'bg-light-accent') : ''}`}
                                onClick={() => setSelectedContact(contact.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <Avatar type="sm" image={contact.profilePicture} />
                                    <span className={`${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}`}>{contact.name}</span>
                                </div>
                            </div>
                        )
                    ))}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button
                        className="px-4 py-2 rounded bg-gray-500 text-white"
                        onClick={() => setShowAddGroupMemberModal(false)}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-2 rounded bg-green-500 text-white"
                        onClick={addMember}
                        disabled={!selectedContact}
                    >
                        Add
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AddGroupMemberModal;
