
import React, { useState, useEffect, useRef } from 'react';
import { Contact, Comment, CustomerStatus, UserProfile } from '../types';
import { analyzeLead } from '../services/geminiService';
import CompanyName from './CompanyName';
import CustomerMetricsView from './CustomerMetricsView';
import SalesReportTab from './SalesReportTab';
import IncidentReportTab from './IncidentReportTab';
import SalesReturnTab from './SalesReturnTab';
import PurchaseHistoryTab from './PurchaseHistoryTab';
import InquiryHistoryTab from './InquiryHistoryTab';
import PersonalCommentsTab from './PersonalCommentsTab';
import UpdateContactApprovalModal from './UpdateContactApprovalModal';
import DiscountRequestModal from './DiscountRequestModal';
import AddContactModal from './AddContactModal';
import { 
  MoreHorizontal, Phone, Mail, Calendar, CheckSquare, FileText, 
  MessageSquare, Send, Star, Pencil, ChevronRight,
  Layout, Briefcase, Clock, CheckCircle, AlertTriangle, ShoppingBag, History, Smartphone, User, Users, DollarSign, MapPin, Cake, Building, TrendingUp, AlertCircle, Gift
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createUpdatedContactDetails, updateContact } from '../services/supabaseService';

interface ContactDetailsProps {
  contact: Contact;
  currentUser?: UserProfile | null;
  onClose: () => void;
  onUpdate: (updatedContact: Contact) => void;
}

const ContactDetails: React.FC<ContactDetailsProps> = ({ contact, currentUser, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('Overview');
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>(contact.comments || []);
  const [aiAnalysis, setAiAnalysis] = useState<{score: number, probability: number} | null>(
    contact.aiScore ? { score: contact.aiScore, probability: contact.winProbability || 0 } : null
  );
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Auto-scroll to new comments
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  useEffect(() => {
    // Prevent auto-scroll on initial mount and ensure top position
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      return;
    }
    // Auto-scroll to new comments only for subsequent updates
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const isOwner = currentUser?.role === 'Owner';

  const buildChangedFields = (previous: Contact, next: Omit<Contact, 'id'>) => {
    const changed: Record<string, { oldValue: unknown; newValue: unknown }> = {};
    Object.keys(next).forEach((key) => {
      const prevValue = (previous as Record<string, unknown>)[key];
      const nextValue = (next as Record<string, unknown>)[key];
      const normalize = (value: unknown) => {
        if (value === undefined) return null;
        if (typeof value === 'object' && value !== null) {
          try {
            return JSON.stringify(value);
          } catch {
            return value;
          }
        }
        return value;
      };
      if (normalize(prevValue) !== normalize(nextValue)) {
        changed[key] = { oldValue: prevValue ?? null, newValue: nextValue ?? null };
      }
    });
    return changed;
  };

  const handleSubmitContactEdit = async (data: Omit<Contact, 'id'>) => {
    if (!currentUser?.id) {
      throw new Error('User not authenticated');
    }
    try {
      if (isOwner) {
        await updateContact(contact.id, data);
        const updated = { ...contact, ...data };
        onUpdate(updated);
        return updated;
      }
      const changedFields = buildChangedFields(contact, data);
      if (Object.keys(changedFields).length === 0) {
        return contact;
      }
      await createUpdatedContactDetails({
        contact_id: contact.id,
        changed_fields: changedFields,
        submitted_by: currentUser.id,
        submitted_date: new Date().toISOString(),
        approval_status: 'pending',
      });
      return contact;
    } catch (error) {
      throw error;
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: currentUser?.full_name || 'Unknown Agent', 
      role: currentUser?.role || 'Sales Agent',
      text: newComment,
      timestamp: 'Just now',
      avatar: currentUser?.avatar_url || 'https://i.pravatar.cc/150'
    };

    const updatedComments = [...comments, comment];
    setComments(updatedComments);
    onUpdate({ ...contact, comments: updatedComments });
    setNewComment('');
  };

  // Simulated AI trigger on mount if not present
  useEffect(() => {
    if (!contact.aiScore) {
      analyzeLead(contact).then(res => {
        setAiAnalysis({ score: res.score, probability: res.winProbability });
        onUpdate({ 
          ...contact, 
          aiScore: res.score, 
          winProbability: res.winProbability, 
          aiReasoning: res.reasoning 
        });
      });
    }
  }, [contact.id]);

  const getStatusColor = (status: CustomerStatus) => {
      // Safety guard in case Enum is undefined
      if (!CustomerStatus) return 'bg-slate-100 text-slate-600';
      
      switch(status) {
          case CustomerStatus.ACTIVE: return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
          case CustomerStatus.INACTIVE: return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
          case CustomerStatus.PROSPECTIVE: return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
          case CustomerStatus.BLACKLISTED: return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
          default: return 'bg-slate-100 text-slate-600';
      }
  };
  
  const yearlySalesData = contact.salesByYear ? Object.entries(contact.salesByYear)
    .map(([year, amount]) => ({
      name: year,
      amount: amount
    }))
    .sort((a, b) => parseInt(a.name) - parseInt(b.name)) 
    : [];

  const tabs = [
    { id: 'Overview', label: 'Overview', icon: Layout },
    { id: 'Metrics', label: 'Metrics', icon: TrendingUp },
    { id: 'SalesReports', label: 'Sales Reports', icon: FileText },
    { id: 'PurchaseHistory', label: 'Purchase History', icon: ShoppingBag },
    { id: 'InquiryHistory', label: 'Inquiries', icon: AlertCircle },
    { id: 'IncidentReports', label: 'Incidents', icon: AlertTriangle },
    { id: 'SalesReturns', label: 'Returns', icon: ShoppingBag },
    { id: 'PersonalComments', label: 'Comments', icon: MessageSquare }
  ];

  return (
    <div ref={scrollContainerRef} className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-y-auto pb-20 animate-fadeIn relative z-30">
      {/* Top Navigation / Header Back */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue cursor-pointer transition-colors" onClick={onClose}>
              <ChevronRight className="w-5 h-5 rotate-180" />
              <span className="font-medium text-sm">Back to Customer Database</span>
          </div>
          <div className="flex items-center gap-3">
               <button 
                onClick={() => setIsDiscountModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded-lg text-sm font-bold transition-colors"
               >
                   <Gift className="w-4 h-4" />
                   Request Discount
               </button>
               <button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-bold transition-colors"
               >
                   <Pencil className="w-4 h-4" />
                   {isOwner ? 'Edit Details' : 'Request Update'}
               </button>
               {isOwner && (
                 <button 
                  onClick={() => setIsUpdateModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition-colors"
                 >
                     <CheckSquare className="w-4 h-4" />
                     Review Updates
                 </button>
               )}
               <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                   <Star className="w-5 h-5" />
               </button>
               <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                   <MoreHorizontal className="w-5 h-5" />
               </button>
          </div>
      </div>

      {/* Profile Header Card */}
      <div className="px-8 py-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-start gap-6">
                  <div className="w-24 h-24 rounded-2xl shadow-md border-2 border-white dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-3xl text-slate-400 dark:text-slate-500">
                      {contact.company ? contact.company.charAt(0) : contact.name.charAt(0)}
                  </div>
                  <div>
                      <div className="flex flex-wrap items-center gap-3 mb-1">
                          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                              <CompanyName 
                                name={contact.company} 
                                pastName={contact.pastName}
                                entity={contact}
                                className="inline-flex flex-wrap items-baseline gap-2"
                                formerNameClassName="text-base text-slate-400 font-medium"
                                formerLabel="Formerly:"
                              />
                          </h1>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(contact.status)} uppercase tracking-wide`}>
                              {contact.status}
                          </span>
                           {contact.isHidden && <span className="bg-slate-800 text-white px-2 py-0.5 rounded text-[10px]">HIDDEN</span>}
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">
                          {contact.province}, {contact.city}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 dark:text-slate-500 mt-3">
                          <span className="flex items-center gap-1.5" title="Assigned Agent">
                              <User className="w-4 h-4 text-brand-blue" /> 
                              <span className="font-medium text-slate-600 dark:text-slate-300">{contact.salesman || 'Unassigned'}</span>
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                          <span className="flex items-center gap-1.5 font-mono">TIN: {contact.tin || 'N/A'}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                          <span className="flex items-center gap-1.5 font-bold">Price Group: <span className="text-brand-blue">{contact.priceGroup || 'N/A'}</span></span>
                      </div>
                  </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Current Balance</p>
                      <p className={`text-3xl font-bold ${contact.balance && contact.balance > 0 ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`}>
                          ₱{(contact.balance || 0).toLocaleString()}
                      </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                       <div className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700">
                           Debt: {contact.debtType || 'Unknown'}
                       </div>
                       <div className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700">
                           Terms: {contact.terms || 'N/A'}
                       </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 sticky top-[73px] z-10 overflow-x-auto">
        <div className="flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-brand-blue text-brand-blue font-bold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'Overview' && (
          <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LEFT COLUMN: Customer Intelligence */}
              <div className="lg:col-span-4 space-y-6">
                  
                  {/* Dealership Info */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                          <Briefcase className="w-5 h-5 text-brand-blue dark:text-blue-400" />
                          <h3 className="font-bold text-slate-800 dark:text-white">Dealership & Terms</h3>
                      </div>
                      <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                              <span className="text-slate-500">Business Line</span>
                              <span className="font-medium text-slate-700 dark:text-slate-200">{contact.businessLine || 'N/A'}</span>
                          </div>
                           <div className="flex justify-between">
                              <span className="text-slate-500">VAT Type</span>
                              <span className="font-medium text-slate-700 dark:text-slate-200">{contact.vatType} ({contact.vatPercentage}%)</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-slate-500">Since</span>
                              <span className="font-medium text-slate-700 dark:text-slate-200">{contact.dealershipSince || contact.customerSince}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-slate-500">Credit Limit</span>
                              <span className="font-medium text-slate-700 dark:text-slate-200">{contact.creditLimit ? `₱${contact.creditLimit.toLocaleString()}` : '0'}</span>
                          </div>
                           <div className="flex justify-between">
                              <span className="text-slate-500">Quota</span>
                              <span className="font-medium text-slate-700 dark:text-slate-200">{contact.dealershipQuota ? `₱${contact.dealershipQuota.toLocaleString()}` : '0'}</span>
                          </div>
                      </div>
                  </div>

                   {/* Addresses */}
                   <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                          <MapPin className="w-5 h-5 text-brand-blue dark:text-blue-400" />
                          <h3 className="font-bold text-slate-800 dark:text-white">Locations</h3>
                      </div>
                      <div className="space-y-4 text-sm">
                          <div>
                              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Official Address</p>
                              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                {contact.address}, {contact.province}, {contact.city}
                              </p>
                          </div>
                           <div>
                              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Delivery Address</p>
                              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                {contact.deliveryAddress || 'Same as above'}
                              </p>
                          </div>
                      </div>
                  </div>

                  {/* Contact Persons */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                       <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                          <Users className="w-5 h-5 text-brand-blue dark:text-blue-400" />
                          <h3 className="font-bold text-slate-800 dark:text-white">Contact Persons</h3>
                      </div>
                      <div className="space-y-4">
                          {contact.contactPersons && contact.contactPersons.length > 0 ? (
                              contact.contactPersons.map((person, idx) => (
                                 <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                                     <div className="flex items-center gap-2 mb-1">
                                         <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{person.name}</span>
                                         <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">{person.position}</span>
                                     </div>
                                     <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                         {person.mobile && <div className="flex items-center gap-2"><Smartphone className="w-3 h-3" /> {person.mobile}</div>}
                                         {person.telephone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> {person.telephone}</div>}
                                         {person.email && <div className="flex items-center gap-2"><Mail className="w-3 h-3" /> {person.email}</div>}
                                         {person.birthday && <div className="flex items-center gap-2"><Cake className="w-3 h-3" /> {person.birthday}</div>}
                                     </div>
                                 </div>
                              ))
                          ) : (
                              <p className="text-sm text-slate-400 italic">No contact persons listed.</p>
                          )}
                      </div>
                  </div>

              </div>

              {/* CENTER/RIGHT: Timeline, Sales, Comments */}
              <div className="lg:col-span-8 space-y-6">
                  
                  {/* Sales History Chart */}
                  {yearlySalesData.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-5">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-4">Sales Performance (Yearly)</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={yearlySalesData}>
                                    <defs>
                                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0F5298" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#0F5298" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" opacity={0.1} />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#121212', borderRadius: '8px', border: 'none', color: '#f8fafc' }}
                                        formatter={(value: number) => [`₱${value.toLocaleString()}`, 'Sales']}
                                    />
                                    <Area type="monotone" dataKey="amount" stroke="#0F5298" fillOpacity={1} fill="url(#colorAmount)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                  )}
                  
                   {/* Comments Section */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-[400px]">
                      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
                          <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold">
                              <MessageSquare className="w-5 h-5 text-brand-blue" />
                              <h3>Comments & Notes</h3>
                          </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-4 space-y-5">
                          {contact.comment && (
                              <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20 p-3 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                                  <span className="font-bold">Important Note:</span> {contact.comment}
                              </div>
                          )}

                          {comments.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                                  <MessageSquare className="w-10 h-10 mb-2 opacity-20" />
                                  <p>No comments yet.</p>
                              </div>
                          ) : (
                              comments.map((comment) => {
                                  // If the logged in user matches the author or if it's explicitly labeled 'Owner' and the current user is Owner
                                  const isMe = currentUser && comment.author === currentUser.full_name;
                                  return (
                                      <div key={comment.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                          <div className="flex-shrink-0">
                                               <img 
                                                  src={comment.avatar || "https://i.pravatar.cc/150"} 
                                                  className={`w-8 h-8 rounded-full border-2 ${isMe ? 'border-brand-blue' : 'border-slate-200 dark:border-slate-600'}`} 
                                                  alt={comment.author} 
                                              />
                                          </div>
                                          <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                                              <div className="flex items-center gap-2 mb-1">
                                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{comment.author}</span>
                                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${isMe || comment.role === 'Owner' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                                      {comment.role}
                                                  </span>
                                              </div>
                                              <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                                                  isMe 
                                                  ? 'bg-brand-blue text-white rounded-tr-none' 
                                                  : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-tl-none'
                                              }`}>
                                                  {comment.text}
                                              </div>
                                              <span className="text-[10px] text-slate-400 mt-1">{comment.timestamp}</span>
                                          </div>
                                      </div>
                                  );
                              })
                          )}
                          <div ref={commentsEndRef} />
                      </div>

                      <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
                          <div className="relative">
                              <input
                                  type="text"
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                                  placeholder="Add a private note..."
                                  className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all shadow-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                              />
                              <button 
                                  onClick={handleAddComment}
                                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${newComment.trim() ? 'bg-brand-blue text-white' : 'text-slate-300 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                              >
                                  <Send className="w-4 h-4" />
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'Metrics' && <CustomerMetricsView contactId={contact.id} />}

        {/* Sales Reports Tab */}
        {activeTab === 'SalesReports' && <SalesReportTab contactId={contact.id} currentUserId={currentUser?.id} />}

        {/* Purchase History Tab */}
        {activeTab === 'PurchaseHistory' && <PurchaseHistoryTab contactId={contact.id} />}

        {/* Inquiry History Tab */}
        {activeTab === 'InquiryHistory' && <InquiryHistoryTab contactId={contact.id} />}

        {/* Incident Reports Tab */}
        {activeTab === 'IncidentReports' && <IncidentReportTab contactId={contact.id} currentUser={currentUser} />}

        {/* Sales Returns Tab */}
        {activeTab === 'SalesReturns' && <SalesReturnTab contactId={contact.id} currentUserId={currentUser?.id} />}

        {/* Personal Comments Tab */}
        {activeTab === 'PersonalComments' && (
          <PersonalCommentsTab 
            contactId={contact.id} 
            currentUserId={currentUser?.id}
            currentUserName={currentUser?.full_name}
            currentUserAvatar={currentUser?.avatar_url}
          />
        )}
      </div>

      {/* Modals */}
      <UpdateContactApprovalModal
        contact={contact}
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        currentUserId={currentUser?.id}
      />

      <DiscountRequestModal
        contactId={contact.id}
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
      />

      <AddContactModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleSubmitContactEdit}
        mode="edit"
        initialData={contact}
        enableToasts
        toastOverrides={{
          success: isOwner
            ? {
                title: 'Customer updated',
                description: 'Customer information has been updated successfully.',
                durationMs: 4000,
              }
            : {
                title: 'Update request submitted',
                description: 'Customer update request has been submitted for approval.',
                durationMs: 4000,
              },
        }}
      />
    </div>
  );
};

export default ContactDetails;
