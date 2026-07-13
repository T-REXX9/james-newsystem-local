import React from 'react';
import ConfirmModal from './ConfirmModal';

interface HighLevelDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
}

const HighLevelDeleteModal: React.FC<HighLevelDeleteModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
}) => (
    <ConfirmModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={onConfirm}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        variant="danger"
        requiredConfirmationText="DELETE"
        confirmationInstruction="Type DELETE to confirm"
    />
);

export default HighLevelDeleteModal;
