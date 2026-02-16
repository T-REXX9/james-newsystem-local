import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import { PromotionPosting, UserProfile } from '../types';
import * as promotionService from '../services/promotionService';

interface Props {
    posting: PromotionPosting;
    promotionTitle: string;
    currentUser: UserProfile;
    onClose: () => void;
    onUploaded: () => void;
}

const UploadProofModal: React.FC<Props> = ({
    posting,
    promotionTitle,
    currentUser,
    onClose,
    onUploaded,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [postUrl, setPostUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (selectedFile: File) => {
        // Validate file type
        if (!selectedFile.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 10MB)
        if (selectedFile.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB');
            return;
        }

        setFile(selectedFile);

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setPreview(e.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(true);
    };

    const handleDragLeave = () => {
        setDragActive(false);
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            alert('Please select a screenshot');
            return;
        }

        setUploading(true);
        try {
            // Upload to storage
            const screenshotUrl = await promotionService.uploadScreenshot(
                file,
                posting.promotion_id,
                posting.platform_name
            );

            if (!screenshotUrl) {
                throw new Error('Failed to upload screenshot');
            }

            // Submit proof
            await promotionService.submitProof(
                posting.id,
                screenshotUrl,
                currentUser.id,
                postUrl || undefined
            );

            onUploaded();
        } catch (error) {
            console.error('Error uploading proof:', error);
            alert('Failed to upload proof. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-lg shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upload Proof</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {posting.platform_name} • {promotionTitle}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Rejection reason display */}
                    {posting.status === 'Rejected' && posting.rejection_reason && (
                        <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-rose-700 dark:text-rose-400 mb-1">
                                    Previous submission rejected
                                </p>
                                <p className="text-sm text-rose-600 dark:text-rose-300">{posting.rejection_reason}</p>
                            </div>
                        </div>
                    )}

                    {/* Drop Zone */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragActive
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600'
                            }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileInputChange}
                            className="hidden"
                        />

                        {preview ? (
                            <div className="space-y-3">
                                <img
                                    src={preview}
                                    alt="Preview"
                                    className="max-h-48 mx-auto rounded-lg"
                                />
                                <p className="text-sm text-slate-600 dark:text-slate-300">{file?.name}</p>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                        setPreview(null);
                                    }}
                                    className="text-sm text-rose-600 hover:text-rose-700"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                    <ImageIcon className="w-8 h-8 text-slate-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Drag and drop your screenshot here
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    or click to browse • Max 10MB
                                </p>
                            </>
                        )}
                    </div>

                    {/* Post URL (Optional) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Post URL (Optional)
                        </label>
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="url"
                                value={postUrl}
                                onChange={(e) => setPostUrl(e.target.value)}
                                placeholder="https://..."
                                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!file || uploading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Uploading...' : 'Submit Proof'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadProofModal;
