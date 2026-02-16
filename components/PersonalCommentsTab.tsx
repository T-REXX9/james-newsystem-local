import React, { useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { fetchPersonalComments, createPersonalComment } from '../services/supabaseService';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

interface PersonalCommentsTabProps {
  contactId: string;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
}

const PersonalCommentsTab: React.FC<PersonalCommentsTabProps> = ({ 
  contactId, 
  currentUserId, 
  currentUserName = 'Unknown User',
  currentUserAvatar 
}) => {
  const { addToast } = useToast();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadComments = async () => {
      try {
        const data = await fetchPersonalComments(contactId);
        setComments(data || []);
      } catch (err) {
        console.error('Error loading comments:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadComments();
  }, [contactId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUserId) return;

    setSubmitting(true);
    try {
      await createPersonalComment(
        contactId,
        currentUserId,
        currentUserName,
        newComment,
        currentUserAvatar
      );
      
      // Add to local state
      const newCommentObj = {
        id: `comment-${Date.now()}`,
        contact_id: contactId,
        author_id: currentUserId,
        author_name: currentUserName,
        author_avatar: currentUserAvatar,
        text: newComment,
        timestamp: new Date().toISOString()
      };
      
      setComments(prev => [newCommentObj, ...prev]);
      setNewComment('');
      addToast({
        type: 'success',
        title: 'Comment added',
        description: 'Your comment has been posted successfully.',
        durationMs: 4000,
      });
    } catch (err) {
      console.error('Error creating comment:', err);
      addToast({
        type: 'error',
        title: 'Unable to add comment',
        description: parseSupabaseError(err, 'comment'),
        durationMs: 6000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading comments...</div>;
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Comment Form */}
      <form onSubmit={handleAddComment} className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          Add Personal Comment
        </label>
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts about this customer..."
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:border-brand-blue outline-none resize-none"
            rows={3}
          />
        </div>
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {comments.length === 0 ? (
          <div className="text-center text-slate-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No comments yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map(comment => (
              <div key={comment.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-3 mb-2">
                  {comment.author_avatar && (
                    <img
                      src={comment.author_avatar}
                      alt={comment.author_name}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800 dark:text-white text-sm">
                        {comment.author_name}
                      </p>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                        {new Date(comment.timestamp).toLocaleDateString()} {new Date(comment.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 break-words">
                  {comment.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalCommentsTab;
