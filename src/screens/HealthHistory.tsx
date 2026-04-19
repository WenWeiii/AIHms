import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, ChevronDown, Search, Filter, Calendar as CalendarIcon, 
  ArrowDownWideNarrow, Download, Trash2, AlertCircle, 
  Activity, Heart, Weight, Moon, Smile, Meh, Frown, Laugh, Star,
  Clock, ShieldAlert, CheckCircle2, MoreVertical, FileText
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, where } from 'firebase/firestore';
import { HealthData, Screen, TriageZone, UserProfile } from '../types';
import { useFirebase } from '../components/FirebaseProvider';
import { useTranslation } from '../components/LanguageProvider';
import { cn } from '../lib/utils';

interface HealthHistoryProps {
  onNavigate?: (screen: Screen) => void;
}

export const HealthHistory: React.FC<HealthHistoryProps> = ({ onNavigate }) => {
  const { user, profile } = useFirebase();
  const { t, language } = useTranslation();
  const [logs, setLogs] = useState<HealthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterZone, setFilterZone] = useState<TriageZone | 'All'>('All');
  const [viewingPatientId, setViewingPatientId] = useState<string | null>(null);
  const [patientProfile, setPatientProfile] = useState<UserProfile | null>(null);
  const [selectedLog, setSelectedLog] = useState<HealthData | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role === 'caregiver' && profile.assignedPatientId) {
      setViewingPatientId(profile.assignedPatientId);
    } else {
      setViewingPatientId(user?.uid || null);
    }
  }, [profile, user]);

  useEffect(() => {
    if (!viewingPatientId) return;

    setLoading(true);
    const healthPath = `users/${viewingPatientId}/healthLogs`;
    // Fetch all logs without fixed limit for "Full Archive"
    const healthQ = query(collection(db, healthPath), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(healthQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HealthData[];
      setLogs(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, healthPath);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [viewingPatientId]);

  const handleDeleteLog = async (logId: string) => {
    if (!viewingPatientId) return;
    try {
      await deleteDoc(doc(db, `users/${viewingPatientId}/healthLogs`, logId));
      setShowDeleteConfirm(null);
      if (selectedLog?.id === logId) setSelectedLog(null);
    } catch (error) {
      console.error("Error deleting log:", error);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.notes?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.triageZone?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterZone === 'All' || log.triageZone === filterZone;
    return matchesSearch && matchesFilter;
  });

  const getTriageColor = (zone?: TriageZone) => {
    switch (zone) {
      case 'Red': return 'bg-tertiary text-on-tertiary';
      case 'Yellow': return 'bg-amber-100 text-amber-700';
      case 'Green': return 'bg-primary/20 text-primary';
      default: return 'bg-outline/10 text-outline';
    }
  };

  const getMoodIcon = (mood?: string) => {
    switch (mood) {
      case 'Excellent': return <Star size={16} className="text-primary" />;
      case 'Good': return <Laugh size={16} className="text-green-500" />;
      case 'Neutral': return <Smile size={16} className="text-amber-500" />;
      case 'Fair': return <Meh size={16} className="text-orange-500" />;
      case 'Poor': return <Frown size={16} className="text-red-500" />;
      default: return <Smile size={16} className="text-outline" />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto px-6 pt-12 pb-40"
    >
      <header className="mb-12 space-y-8">
        <button 
          onClick={() => onNavigate?.('dashboard')}
          className="flex items-center gap-2 text-primary hover:gap-3 transition-all"
        >
          <ChevronLeft size={20} />
          <span className="text-xs font-headline font-black uppercase tracking-widest">{t('common.back_to_dashboard')}</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-6xl md:text-7xl font-headline font-black text-primary tracking-tighter leading-none">
              {t('dashboard.full_archive')}
            </h1>
            <p className="text-on-surface-variant text-xl max-w-md">
              {t('history.archive_desc', { target: profile?.role === 'caregiver' ? (patientProfile?.displayName || t('onboarding.patient')) : t('common.you') })}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-surface-container-low px-6 py-4 rounded-2xl border border-outline/10 flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-right">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-outline">{t('history.total_records')}</p>
                <p className="text-2xl font-headline font-black text-primary">{logs.length}</p>
              </div>
              <div className="h-8 w-px bg-outline/10" />
              <FileText size={24} className="text-primary opacity-40" />
            </div>
          </div>
        </div>
      </header>

      {/* Filters Toolbar */}
      <section className="mb-10 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors" size={20} />
          <input 
            type="text"
            placeholder={t('history.search_logs')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-14 bg-surface-container-low pl-12 pr-6 rounded-2xl border border-outline/10 focus:outline-primary transition-all font-headline font-bold text-sm"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-surface-container-low px-4 rounded-2xl border border-outline/10 relative">
            <Filter size={18} className="text-outline" />
            <select 
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value as any)}
              className="bg-transparent h-14 focus:outline-none font-headline font-bold text-xs uppercase tracking-widest appearance-none pr-8"
            >
              <option value="All">{t('history.all_zones')}</option>
              <option value="Red">Critical ({t('dashboard.zone_red')})</option>
              <option value="Yellow">Warning ({t('dashboard.zone_yellow')})</option>
              <option value="Green">Stable ({t('dashboard.zone_green')})</option>
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
          </div>
          <button className="h-14 w-14 bg-surface-container-low rounded-2xl border border-outline/10 flex items-center justify-center text-outline hover:text-primary hover:bg-primary/5 transition-all">
            <Download size={20} />
          </button>
        </div>
      </section>

      {/* Logs Table-like Desktop View / Card Mobile View */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface-container-low rounded-3xl animate-pulse shadow-sm" />
          ))
        ) : filteredLogs.length === 0 ? (
          <div className="bg-surface-container-low rounded-3xl p-20 text-center border-2 border-dashed border-outline/10">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6 text-primary opacity-40">
              <Clock size={40} />
            </div>
            <h3 className="text-2xl font-headline font-black text-on-surface mb-2">{t('history.no_records_found')}</h3>
            <p className="text-on-surface-variant max-w-xs mx-auto">{t('history.adjust_filters')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredLogs.map((log) => (
              <motion.div 
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "bg-surface-container-highest p-6 rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:bg-surface-container-high transition-all border-2 border-transparent",
                  selectedLog?.id === log.id && "border-primary/20 bg-primary/5"
                )}
                onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
              >
                <div className="flex items-center gap-6">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                    log.triageZone === 'Red' ? "bg-tertiary/10 text-tertiary" : 
                    log.triageZone === 'Yellow' ? "bg-amber-100 text-amber-700" :
                    "bg-primary/10 text-primary"
                  )}>
                    {log.triageZone === 'Red' ? <ShieldAlert size={24} /> : 
                     log.triageZone === 'Yellow' ? <Clock size={24} /> : 
                     <CheckCircle2 size={24} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-outline mb-1">
                      {new Date(log.timestamp).toLocaleDateString(language === 'ms' ? 'ms-MY' : language === 'zh' ? 'zh-CN' : 'en-MY', { 
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-headline font-black text-primary">{log.heartRate} <span className="text-[10px] opacity-60">BPM</span></span>
                      <div className="w-1 h-1 bg-outline/20 rounded-full" />
                      <span className="text-lg font-headline font-black text-on-surface">{log.bloodPressure}</span>
                      <div className="w-1 h-1 bg-outline/20 rounded-full" />
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                        getTriageColor(log.triageZone)
                      )}>
                        {log.triageZone}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 md:justify-end">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Weight size={14} className="opacity-40" />
                    <span className="text-sm font-bold">{log.weight}kg</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    {getMoodIcon(log.mood)}
                    <span className="text-sm font-bold">{t(`mood.${(log.mood || 'Good').toLowerCase()}`)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Activity size={14} className="opacity-40" />
                    <span className="text-sm font-bold">{log.steps?.toLocaleString()} steps</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(log.id);
                      }}
                      className="p-2 text-outline hover:text-tertiary hover:bg-tertiary/10 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button className="p-2 text-outline hover:text-primary hover:bg-primary/10 rounded-xl transition-all">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {selectedLog?.id === log.id && log.notes && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="w-full border-t border-outline/10 mt-4 pt-4 text-sm text-on-surface-variant italic leading-relaxed md:col-span-full"
                    >
                      <p>"{log.notes}"</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface p-10 rounded-[2.5rem] shadow-2xl z-[101] border border-outline/10"
            >
              <div className="w-20 h-20 bg-tertiary/10 rounded-3xl flex items-center justify-center text-tertiary mx-auto mb-8">
                <ShieldAlert size={40} />
              </div>
              <h3 className="text-3xl font-headline font-black text-center text-on-surface mb-4">{t('history.delete_title')}</h3>
              <p className="text-on-surface-variant text-center mb-10 leading-relaxed font-medium">
                {t('history.delete_desc')}
              </p>
              <div className="space-y-4">
                <button 
                  onClick={() => handleDeleteLog(showDeleteConfirm)}
                  className="w-full py-5 bg-tertiary text-on-tertiary rounded-2xl font-headline font-black uppercase tracking-widest text-sm shadow-lg shadow-tertiary/20 hover:scale-105 active:scale-95 transition-all"
                >
                  {t('common.delete')}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="w-full py-5 bg-surface-container-highest text-on-surface rounded-2xl font-headline font-black uppercase tracking-widest text-sm hover:bg-surface-container-high transition-all"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
