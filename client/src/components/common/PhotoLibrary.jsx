import Modal from "./Modal";

const IMAGES = Array.from({ length: 9 }, (_, i) => `/avatars/${i + 1}.png`);

export default function PhotoLibrary({ setImage, onClose }) {
    return (
        <Modal title="Choose an avatar" onClose={onClose}>
            <div className="grid grid-cols-3 gap-4">
                {IMAGES.map((image, index) => (
                    <button
                        key={image}
                        type="button"
                        onClick={() => {
                            setImage(image);
                            onClose();
                        }}
                        aria-label={`Select avatar ${index + 1}`}
                        className="flex items-center justify-center rounded-full bg-light-surface p-1 shadow-md transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-light-accent dark:bg-dark-surface dark:focus:ring-dark-accent"
                    >
                        <img src={image} alt="" className="h-16 w-16 rounded-full object-cover" />
                    </button>
                ))}
            </div>
        </Modal>
    );
}
