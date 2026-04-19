import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Shield, Search, Filter, MoreVertical, CheckCircle2, XCircle, AlertCircle, TrendingUp, Settings, Activity, Calendar, ExternalLink, Clock, Trash2 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDocs, collectionGroup, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, HealthData, Appointment } from '../types';
import { useTranslation } from '../components/LanguageProvider';
import { cn } from '@/src/lib/utils';

export const Admin: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'patient' | 'caregiver' | 'admin'>('all');
  const [stats, setStats] = useState({
    totalUsers: 0,
    patients: 0,
    caregivers: 0,
    newToday: 0
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptSearchQuery, setApptSearchQuery] = useState('');
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
      
      const patients = usersData.filter(u => u.role === 'patient').length;
      const caregivers = usersData.filter(u => u.role === 'caregiver').length;
      const today = new Date().toISOString().split('T')[0];
      const newToday = usersData.filter(u => u.createdAt?.split('T')[0] === today).length;

      setStats({
        totalUsers: usersData.length,
        patients,
        caregivers,
        newToday
      });
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collectionGroup(db, 'appointments'), orderBy('date', 'asc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(a => (a as any).status !== 'pending') as Appointment[];
      setAppointments(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'collectionGroup:appointments');
    });
    return () => unsubscribe();
  }, []);

  const getUser = (userId?: string) => {
    return users.find(u => u.uid === userId);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 pt-12 pb-40 space-y-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-headline font-black uppercase tracking-widest border border-primary/20">
              System Admin
            </span>
            <span className="text-outline text-xs font-headline font-black uppercase tracking-widest">v1.2.4</span>
          </div>
          <h1 className="font-headline text-6xl md:text-8xl font-black text-primary leading-[0.85] tracking-tighter">
            Control<br />
            <span className="text-tertiary">Center</span>
          </h1>
          <p className="text-on-surface-variant text-xl max-w-md leading-relaxed font-medium">
            Overseeing the AIHMs ecosystem. Manage users, monitor patterns, and ensure system integrity.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline/5 shadow-ambient flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-headline font-black text-outline uppercase tracking-widest">Total Users</p>
              <p className="text-2xl font-headline font-black text-on-surface">{stats.totalUsers}</p>
            </div>
          </div>
          <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline/5 shadow-ambient flex items-center gap-4">
            <div className="w-12 h-12 bg-tertiary/10 rounded-2xl flex items-center justify-center text-tertiary">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-headline font-black text-outline uppercase tracking-widest">New Today</p>
              <p className="text-2xl font-headline font-black text-on-surface">+{stats.newToday}</p>
            </div>
          </div>
        </div>
      </header>

      {/* User Management Section */}
      <section className="bg-surface-container-low rounded-[3rem] p-8 shadow-ambient border border-outline/5 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-primary p-3 rounded-2xl text-on-primary shadow-sm">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-headline font-black text-on-surface">User Directory</h2>
              <p className="text-sm font-medium text-on-surface-variant">Active members in the Guardian network.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 w-full md:w-auto">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-surface-container-highest/50 border border-outline/10 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:outline-primary transition-all outline-none w-full md:w-64"
              />
            </div>
            
            <div className="flex p-1 bg-surface-container-highest/50 rounded-2xl border border-outline/10 self-start">
              {(['all', 'patient', 'caregiver', 'admin'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setFilterRole(role)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-headline font-black uppercase tracking-widest transition-all",
                    filterRole === role 
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-outline hover:text-on-surface hover:bg-surface-container-highest"
                  )}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-outline/5 bg-surface-container-lowest">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-highest/20">
                <th className="px-6 py-5 text-[10px] font-headline font-black uppercase tracking-widest text-outline">User</th>
                <th className="px-6 py-5 text-[10px] font-headline font-black uppercase tracking-widest text-outline">Role</th>
                <th className="px-6 py-5 text-[10px] font-headline font-black uppercase tracking-widest text-outline">Joined</th>
                <th className="px-6 py-5 text-[10px] font-headline font-black uppercase tracking-widest text-outline">Status</th>
                <th className="px-6 py-5 text-[10px] font-headline font-black uppercase tracking-widest text-outline">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/5">
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={user.uid}
                    className="hover:bg-primary/5 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <img 
                          src={user.photoURL} 
                          alt="" 
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-xl bg-surface-container-highest object-cover border border-outline/5"
                        />
                        <div>
                          <p className="font-headline font-black text-on-surface text-sm">{user.displayName}</p>
                          <p className="text-xs text-on-surface-variant font-medium">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-headline font-black uppercase tracking-widest border",
                        user.role === 'admin' ? "bg-primary/10 text-primary border-primary/20" :
                        user.role === 'caregiver' ? "bg-tertiary/10 text-tertiary border-tertiary/20" :
                        "bg-amber-100 text-amber-700 border-amber-200"
                      )}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-headline font-black text-on-surface-variant">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-headline font-black uppercase tracking-widest text-green-600">Active</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 relative">
                      <button 
                        onClick={() => setActiveActionMenu(activeActionMenu === user.uid ? null : user.uid)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          activeActionMenu === user.uid ? "bg-primary text-on-primary" : "hover:bg-surface-container-highest"
                        )}
                      >
                        <MoreVertical size={18} className={activeActionMenu === user.uid ? "" : "text-outline"} />
                      </button>

                      <AnimatePresence>
                        {activeActionMenu === user.uid && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActiveActionMenu(null)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-6 top-16 w-56 bg-surface shadow-2xl rounded-2xl border border-outline/10 p-2 z-50 py-3"
                            >
                              <div className="px-4 py-2 mb-2">
                                <p className="text-[10px] font-headline font-black text-outline uppercase tracking-widest">User Controls</p>
                              </div>
                              <button 
                                onClick={async () => {
                                  if (confirm("Promote this user to Admin?")) {
                                    await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
                                    setActiveActionMenu(null);
                                  }
                                }}
                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-primary/5 rounded-xl transition-all group"
                              >
                                <Shield size={16} className="text-primary" />
                                <span className="text-xs font-headline font-black uppercase tracking-widest">Promote to Admin</span>
                              </button>
                              <button 
                                onClick={async () => {
                                  if (confirm("Reset onboarding for this user?")) {
                                    await updateDoc(doc(db, 'users', user.uid), { hasCompletedOnboarding: false });
                                    setActiveActionMenu(null);
                                  }
                                }}
                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-tertiary/5 rounded-xl transition-all"
                              >
                                <Settings size={16} className="text-tertiary" />
                                <span className="text-xs font-headline font-black uppercase tracking-widest">Reset Onboarding</span>
                              </button>
                              <div className="h-px bg-outline/5 my-2" />
                              <button 
                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-error/5 text-error rounded-xl transition-all group"
                                onClick={() => alert("Deletion is restricted for safety. Contact Dev support.")}
                              >
                                <Trash2 size={16} />
                                <span className="text-xs font-headline font-black uppercase tracking-widest">Deactivate Account</span>
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredUsers.length === 0 && !loading && (
            <div className="p-20 text-center space-y-4">
              <div className="w-20 h-20 bg-surface-container-highest rounded-full flex items-center justify-center mx-auto text-outline">
                <Search size={40} />
              </div>
              <p className="font-headline font-bold text-on-surface-variant uppercase tracking-widest text-xs">No matching users found</p>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section className="bg-surface-container-low rounded-[3rem] p-8 shadow-ambient border border-outline/5 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-tertiary p-3 rounded-2xl text-on-tertiary shadow-sm">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-headline font-black text-on-surface">Upcoming Appointments</h2>
              <p className="text-sm font-medium text-on-surface-variant">Centralized view of all scheduled health events.</p>
            </div>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
            <input 
              type="text"
              placeholder="Filter by patient name..."
              value={apptSearchQuery}
              onChange={(e) => setApptSearchQuery(e.target.value)}
              className="w-full bg-surface-container-highest/50 border-none rounded-2xl py-4 pl-12 pr-6 text-xs font-headline font-black focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-outline/5 bg-surface-container-lowest">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-highest/20">
                <th className="px-6 py-5 text-[10px] font-headline font-black uppercase tracking-widest text-outline">Patient</th>
                <th className="px-6 py-5 text-[10px] font-headline font-black uppercase tracking-widest text-outline">Event</th>
                <th className="px-6 py-5 text-[10px] font-headline font-black uppercase tracking-widest text-outline">Schedule</th>
                <th className="px-6 py-5 text-[10px] font-headline font-black uppercase tracking-widest text-outline">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/5">
              {appointments
                .filter(appt => {
                  if (!apptSearchQuery) return true;
                  const patient = getUser(appt.userId);
                  return patient?.displayName.toLowerCase().includes(apptSearchQuery.toLowerCase());
                })
                .map((appt) => {
                  const patient = getUser(appt.userId);
                  const isPast = new Date(appt.date) < new Date();
                  
                  return (
                    <tr key={appt.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4">
                        {patient ? (
                          <div className="flex items-center gap-3">
                            <img 
                              src={patient.photoURL} 
                              alt="" 
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-lg bg-surface-container-highest object-cover"
                            />
                            <div>
                              <p className="font-headline font-black text-on-surface text-xs">{patient.displayName}</p>
                              <p className="text-[10px] text-on-surface-variant font-medium">{patient.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-outline font-bold">Unknown Patient</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-headline font-black text-on-surface text-sm">{appt.title}</p>
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{appt.type}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <Clock size={14} className="text-outline" />
                          <span className="text-xs font-headline font-black">
                            {new Date(appt.date).toLocaleDateString()} • {appt.time}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-headline font-black uppercase tracking-widest border",
                          isPast ? "bg-surface-container-highest text-outline border-outline/10" :
                          "bg-green-100 text-green-700 border-green-200"
                        )}>
                          {isPast ? 'Past' : appt.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center">
                    <p className="text-xs font-headline font-black text-outline uppercase tracking-widest">No upcoming appointments</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
