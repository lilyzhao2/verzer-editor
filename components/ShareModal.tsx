'use client';

import React, { useState } from 'react';
import { Link, Copy, Check, Globe, Users, Mail, Lock, X } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentName: string;
  versionId: string;
}

type ShareMode = 'public' | 'restricted' | 'private';

export function ShareModal({ isOpen, onClose, documentName, versionId }: ShareModalProps) {
  const [shareMode, setShareMode] = useState<ShareMode>('private');
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Generate a shareable link (in production, this would be a real URL)
  const shareLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/shared/${versionId}`
    : `/shared/${versionId}`;
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleAddEmail = () => {
    if (emailInput && emailInput.includes('@')) {
      setEmails([...emails, emailInput]);
      setEmailInput('');
    }
  };
  
  const handleRemoveEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email));
  };
  
  const handleShare = () => {
    // In production, this would send invitations and update permissions
    console.log('Sharing with:', { mode: shareMode, emails });
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-black">Share "{documentName}"</h2>
            <p className="text-sm text-gray-600 mt-1">Choose who can access this document</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Share Link */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Share Link</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Access Level */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Access Level</label>
          <div className="space-y-2">
            {/* Public */}
            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                value="public"
                checked={shareMode === 'public'}
                onChange={(e) => setShareMode(e.target.value as ShareMode)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-black">Public</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Anyone with the link can view this document
                </p>
              </div>
            </label>
            
            {/* Restricted */}
            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                value="restricted"
                checked={shareMode === 'restricted'}
                onChange={(e) => setShareMode(e.target.value as ShareMode)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-black">Restricted</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Only people you invite can access this document
                </p>
              </div>
            </label>
            
            {/* Private */}
            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                value="private"
                checked={shareMode === 'private'}
                onChange={(e) => setShareMode(e.target.value as ShareMode)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-black">Private</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Only you can access this document
                </p>
              </div>
            </label>
          </div>
        </div>
        
        {/* Email Invitations */}
        {shareMode === 'restricted' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              Invite by Email
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={handleAddEmail}
                disabled={!emailInput.includes('@')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            
            {/* Email List */}
            {emails.length > 0 && (
              <div className="space-y-2">
                {emails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm text-gray-700">{email}</span>
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Permissions Info */}
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Shared users can view and comment but cannot edit the document. 
            To allow editing, create a branch for them.
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Link className="w-4 h-4" />
            Update Sharing
          </button>
        </div>
      </div>
    </div>
  );
}
