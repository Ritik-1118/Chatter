import React, { useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";
import { useTheme } from '@/context/ThemeContext';

const SettingModal = ({ onClose }) => {
  const { theme, toggleTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [microphoneGranted, setMicrophoneGranted] = useState(false);
  const [enterToSend, setEnterToSend] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'camera' }).then((result) => {
        setCameraGranted(result.state === 'granted');
        result.onchange = () => setCameraGranted(result.state === 'granted');
      }).catch(() => {});
      navigator.permissions.query({ name: 'microphone' }).then((result) => {
        setMicrophoneGranted(result.state === 'granted');
        result.onchange = () => setMicrophoneGranted(result.state === 'granted');
      }).catch(() => {});
    }
    const saved = localStorage.getItem('enterToSend');
    if (saved !== null) setEnterToSend(saved === 'true');
  }, []);

  const handleNotificationToggle = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        setNotificationsEnabled(permission === 'granted');
      } else if (Notification.permission === 'granted') {
        setNotificationsEnabled(false);
      } else {
        setNotificationsEnabled(false);
      }
    }
  };

  const handleCameraToggle = async () => {
    if (!cameraGranted) {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraGranted(true);
      } catch {
        setCameraGranted(false);
      }
    }
  };

  const handleMicrophoneToggle = async () => {
    if (!microphoneGranted) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicrophoneGranted(true);
      } catch {
        setMicrophoneGranted(false);
      }
    }
  };

  const handleEnterToSendToggle = () => {
    const newValue = !enterToSend;
    setEnterToSend(newValue);
    localStorage.setItem('enterToSend', newValue);
    if (typeof onEnterToSendChange === 'function') {
      onEnterToSendChange(newValue);
    }
  };

  return (
    <div className="fixed left-[4.5rem] bottom-[1.5rem] z-50 flex items-end justify-start pointer-events-none">
      <div className={`relative flex flex-col items-start px-8 py-8 rounded-xl shadow-2xl max-w-sm w-full animate-fade-in ring-2 backdrop-blur-2xl ${theme === 'dark' ? 'bg-dark-secondary-background border-dark-divider text-dark-primary-text' : 'bg-light-secondary-background border-light-divider text-light-primary-text'} border pointer-events-auto`}>
        <button
          className="absolute top-4 right-4 text-2xl focus:outline-none"
          onClick={onClose}
          aria-label="Close settings modal"
        >
          <IoClose />
        </button>
        <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}`}>Settings</h2>
        <div className="flex flex-col gap-4 w-full">
          {/* Notifications Toggle */}
          <div className="flex gap-2 items-center justify-between w-full">
            <span>Notifications</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notificationsEnabled}
                onChange={handleNotificationToggle}
              />
              <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${notificationsEnabled ? 'bg-green-500' : 'bg-gray-300'} peer-focus:outline-none`}></div>
              <div className={`absolute left-0 top-0 h-6 w-11 pointer-events-none`}>
                <span className={`absolute top-1/2 left-1 transition-transform duration-200 transform -translate-y-1/2 bg-white w-5 h-5 rounded-full shadow ${notificationsEnabled ? 'translate-x-5' : ''}`}></span>
              </div>
            </label>
          </div>
          {/* Dark Mode Toggle */}
          <div className="flex gap-4 items-center justify-between w-full">
            <span>Dark Mode</span>
            <button
              onClick={toggleTheme}
              className={`px-3 py-1 rounded-lg font-semibold shadow transition-all duration-200 ${theme === 'dark' ? 'bg-dark-accent text-dark-surface' : 'bg-light-accent text-light-surface'}`}
            >
              {theme === 'dark' ? 'Disable' : 'Enable'}
            </button>
          </div>
          {/* Camera Permission Toggle */}
          <div className="flex gap-2 items-center justify-between w-full">
            <span>Camera</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={cameraGranted}
                onChange={handleCameraToggle}
                disabled={cameraGranted}
              />
              <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${cameraGranted ? 'bg-green-500' : 'bg-gray-300'} peer-focus:outline-none`}></div>
              <div className={`absolute left-0 top-0 h-6 w-11 pointer-events-none`}>
                <span className={`absolute top-1/2 left-1 transition-transform duration-200 transform -translate-y-1/2 bg-white w-5 h-5 rounded-full shadow ${cameraGranted ? 'translate-x-5' : ''}`}></span>
              </div>
            </label>
          </div>
          {/* Microphone Permission Toggle */}
          <div className="flex gap-2 items-center justify-between w-full">
            <span>Microphone</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={microphoneGranted}
                onChange={handleMicrophoneToggle}
                disabled={microphoneGranted}
              />
              <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${microphoneGranted ? 'bg-green-500' : 'bg-gray-300'} peer-focus:outline-none`}></div>
              <div className={`absolute left-0 top-0 h-6 w-11 pointer-events-none`}>
                <span className={`absolute top-1/2 left-1 transition-transform duration-200 transform -translate-y-1/2 bg-white w-5 h-5 rounded-full shadow ${microphoneGranted ? 'translate-x-5' : ''}`}></span>
              </div>
            </label>
          </div>
          {/* Enter to Send Toggle */}
          <div className="flex gap-4 items-center justify-between w-full">
            <span>Send on Enter</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={enterToSend}
                onChange={handleEnterToSendToggle}
              />
              <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${enterToSend ? 'bg-green-500' : 'bg-gray-300'} peer-focus:outline-none`}></div>
              <div className={`absolute left-0 top-0 h-6 w-11 pointer-events-none`}>
                <span className={`absolute top-1/2 left-1 transition-transform duration-200 transform -translate-y-1/2 bg-white w-5 h-5 rounded-full shadow ${enterToSend ? 'translate-x-5' : ''}`}></span>
              </div>
            </label>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 1.2s cubic-bezier(0.4,0,0.2,1) both;
        }
      `}</style>
    </div>
  );
};

export default SettingModal; 