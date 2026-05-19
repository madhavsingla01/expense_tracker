import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, MessageSquare, Send } from 'lucide-react';
import API from '../config/api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';

const FEEDBACK_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'payment', label: 'Payment' },
  { value: 'import', label: 'Import' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
];

export default function FeedbackPage() {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState('');
  const [category, setCategory] = useState('general');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const message = feedback.trim();
    if (!message || isSubmitting) return;

    setIsSubmitting(true);
    setError('');
    try {
      await API.post('/feedback', {
        message,
        category,
        page: window.location.pathname,
      });
      setIsSubmitted(true);
      setFeedback('');
      setCategory('general');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 md:p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6 min-w-0">
          <Avatar src={user?.avatar} name={user?.name} email={user?.email} size="md" />
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-[#FFFFFF] truncate">Send Feedback</h2>
            <p className="text-sm text-[#7A7A7A] truncate">{user?.email || 'Your feedback is linked to your account'}</p>
          </div>
        </div>

        {isSubmitted ? (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-[fadeIn_0.5s_ease-out]">
            <CheckCircle2 size={64} className="text-[#34A853] mb-4" />
            <h3 className="text-xl font-bold text-[#FFFFFF] mb-2">Thank you</h3>
            <p className="text-[#B0B0B0] mb-6">Your feedback has been received and will be reviewed by our team.</p>
            <button
              onClick={() => setIsSubmitted(false)}
              className="min-h-[44px] px-6 py-2 bg-[#2A2A2A] hover:bg-[#333333] text-[#FFFFFF] rounded-xl transition"
            >
              Send Another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-[#7A7A7A]">
                Type
              </label>
              <div className="relative">
                <MessageSquare size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7A7A7A]" />
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full min-h-[48px] bg-[#121212] border border-[#2A2A2A] rounded-xl pl-11 pr-10 text-[#FFFFFF] focus:outline-none focus:border-amber-500/50 appearance-none"
                >
                  {FEEDBACK_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7A7A7A] pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-[#7A7A7A]">
                Message
              </label>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value.slice(0, 2000))}
                placeholder="Share a suggestion, report an issue, or describe what needs attention..."
                className="w-full min-h-[120px] bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4 text-[#FFFFFF] placeholder-[#7A7A7A] focus:outline-none focus:border-amber-500/50 resize-y transition"
                required
              />
              <div className="text-right text-xs text-[#7A7A7A]">{feedback.length}/2000</div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!feedback.trim() || isSubmitting}
              className="w-full min-h-[52px] flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-4 rounded-xl transition-all"
            >
              {isSubmitting ? <div className="h-5 w-5 rounded-full border-2 border-black/20 border-t-black animate-spin" /> : <Send size={18} />}
              Submit Feedback
            </button>
          </form>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
