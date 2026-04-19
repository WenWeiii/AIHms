import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquareHeart } from 'lucide-react';
import { useFirebase } from '../FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import { useTranslation } from '../LanguageProvider';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { user } = useFirebase();
  const { t } = useTranslation();
  const [feedback, setFeedback] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setFeedback('');
      setSubmitted(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!feedback.trim() || !user) return;
    setSubmitting(true);

    const path = 'feedback';
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        userEmail: user.email,
        content: feedback,
        timestamp: serverTimestamp(),
        status: 'new'
      });
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setFeedback('');
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-on-surface/10 backdrop-blur-xl" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 40 }}
            className="bg-surface-container-low w-full max-w-xl rounded-[3rem] p-12 shadow-2xl relative z-10"
          >
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-tertiary/10 rounded-2xl flex items-center justify-center text-tertiary">
                  <MessageSquareHeart size={28} />
                </div>
                <h2 className="text-3xl font-headline font-black text-primary tracking-tighter">{t('feedback.title')}</h2>
              </div>
              <button onClick={onClose} className="w-12 h-12 rounded-xl hover:bg-on-surface/5 flex items-center justify-center transition-all">
                <X size={32} className="text-outline" />
              </button>
            </div>

            {submitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 space-y-6"
              >
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                  <Send size={40} />
                </div>
                <h3 className="text-2xl font-headline font-black text-primary">{t('feedback.thanks')}</h3>
                <p className="text-on-surface-variant text-lg">{t('feedback.thanks_desc')}</p>
              </motion.div>
            ) : (
              <div className="space-y-8">
                <p className="text-on-surface-variant text-lg leading-relaxed">
                  {t('feedback.desc')}
                </p>
                <div className="space-y-4">
                  <label className="text-xs font-headline font-black uppercase tracking-widest text-outline ml-2">{t('feedback.label')}</label>
                  <textarea 
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full bg-surface-container-highest p-8 rounded-[2rem] font-headline font-bold text-lg focus:outline-primary h-48 resize-none transition-all"
                    placeholder={t('feedback.placeholder')}
                  />
                </div>

                <button 
                  onClick={handleSubmit}
                  disabled={!feedback.trim() || submitting}
                  className="w-full py-6 signature-gradient text-on-primary rounded-2xl font-headline font-black text-xl shadow-ambient hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {submitting ? t('feedback.submitting') : t('feedback.submit')}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
