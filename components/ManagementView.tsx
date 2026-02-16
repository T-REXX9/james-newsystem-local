import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  Activity,
} from 'lucide-react';
import {
  fetchMonthlySalesPerformanceBySalesperson,
  fetchMonthlySalesPerformanceByCity,
  fetchSalesPerformanceByCustomerStatus,
  fetchSalesPerformanceByPaymentType,
  fetchInactiveCustomers,
  fetchInactiveCriticalCustomers,
  fetchInquiryOnlyCustomers,
  fetchContacts,
} from '../services/supabaseService';
import { CustomerStatusNotification, InquiryOnlyAlert } from '../types';
import ContactDetails from './ContactDetails';

interface ManagementViewProps {
  currentUser?: any;
}

export const ManagementView: React.FC<ManagementViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'team' | 'city' | 'status' | 'payment' | 'alerts'>('team');
  const [salesByTeam, setSalesByTeam] = useState<any[]>([]);
  const [salesByCity, setSalesByCity] = useState<any[]>([]);
  const [salesByStatus, setSalesByStatus] = useState<any[]>([]);
  const [salesByPayment, setSalesByPayment] = useState<any[]>([]);
  const [inactiveCustomers, setInactiveCustomers] = useState<any[]>([]);
  const [inactiveCritical, setInactiveCritical] = useState<any[]>([]);
  const [inquiryOnlyCustomers, setInquiryOnlyCustomers] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [team, city, status, payment, inactive, criticalInactive, inquiryOnly] = await Promise.all([
          fetchMonthlySalesPerformanceBySalesperson(currentYear, currentMonth),
          fetchMonthlySalesPerformanceByCity(currentYear, currentMonth),
          fetchSalesPerformanceByCustomerStatus(currentYear, currentMonth),
          fetchSalesPerformanceByPaymentType(currentYear, currentMonth),
          fetchInactiveCustomers(30),
          fetchInactiveCriticalCustomers(30),
          fetchInquiryOnlyCustomers(2),
        ]);

        setSalesByTeam(team);
        setSalesByCity(city);
        setSalesByStatus(status);
        setSalesByPayment(payment);
        setInactiveCustomers(inactive);
        setInactiveCritical(criticalInactive);
        setInquiryOnlyCustomers(inquiryOnly);
      } catch (err) {
        console.error('Error loading management data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentMonth, currentYear]);

  const totalCurrentMonthSales = salesByTeam.reduce((sum, s) => sum + s.currentMonthSales, 0);
  const totalPreviousMonthSales = salesByTeam.reduce((sum, s) => sum + s.previousMonthSales, 0);
  const totalSalesChange = totalCurrentMonthSales - totalPreviousMonthSales;
  const totalPercentageChange = totalPreviousMonthSales > 0 
    ? ((totalCurrentMonthSales - totalPreviousMonthSales) / totalPreviousMonthSales * 100)
    : 0;

  const COLORS = ['#0F5298', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const MetricCard = ({ label, value, change, icon: Icon, color }: any) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">
            {typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value}
          </p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-xs font-medium">{Math.abs(change).toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-500 dark:text-slate-400">Loading management data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
      {selectedContact && (
        <ContactDetails
          contact={selectedContact}
          isOpen={!!selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdate={() => {}}
        />
      )}

      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Management Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Sales performance and customer insights for {new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Total Sales"
            value={`₱${totalCurrentMonthSales.toLocaleString()}`}
            change={totalPercentageChange}
            icon={DollarSign}
            color="bg-blue-500"
          />
          <MetricCard
            label="Active Customers"
            value={salesByStatus.find(s => s.status === 'Active')?.customerCount || 0}
            icon={Users}
            color="bg-green-500"
          />
          <MetricCard
            label="Inactive Customers"
            value={inactiveCustomers.length}
            icon={Activity}
            color="bg-yellow-500"
          />
          <MetricCard
            label="Critical Alerts"
            value={inactiveCritical.length + inquiryOnlyCustomers.length}
            icon={AlertTriangle}
            color="bg-red-500"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          {['team', 'city', 'status', 'payment', 'alerts'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Team Performance Tab */}
        {activeTab === 'team' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Sales by Salesperson</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByTeam}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" opacity={0.1} />
                  <XAxis dataKey="salesPersonName" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#f8fafc' }}
                    formatter={(value: any) => [`₱${value.toLocaleString()}`, '']}
                  />
                  <Legend />
                  <Bar dataKey="currentMonthSales" fill="#0F5298" name="Current Month" />
                  <Bar dataKey="previousMonthSales" fill="#94a3b8" name="Previous Month" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Salesperson</th>
                    <th className="text-right py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Current Month</th>
                    <th className="text-right py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Previous Month</th>
                    <th className="text-right py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Change</th>
                    <th className="text-right py-3 px-4 font-bold text-slate-700 dark:text-slate-300">% Change</th>
                    <th className="text-right py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Customers</th>
                  </tr>
                </thead>
                <tbody>
                  {salesByTeam.map((row) => (
                    <tr key={row.salesPersonName} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200">{row.salesPersonName}</td>
                      <td className="text-right py-3 px-4 text-slate-800 dark:text-slate-200">₱{row.currentMonthSales.toLocaleString()}</td>
                      <td className="text-right py-3 px-4 text-slate-600 dark:text-slate-400">₱{row.previousMonthSales.toLocaleString()}</td>
                      <td className={`text-right py-3 px-4 font-medium ${row.salesChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        ₱{row.salesChange.toLocaleString()}
                      </td>
                      <td className={`text-right py-3 px-4 font-medium ${row.percentageChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {row.percentageChange.toFixed(1)}%
                      </td>
                      <td className="text-right py-3 px-4 text-slate-800 dark:text-slate-200">{row.customerCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* City Performance Tab */}
        {activeTab === 'city' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Sales by City</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByCity} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" opacity={0.1} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val / 1000}k`} />
                  <YAxis dataKey="city" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#f8fafc' }}
                    formatter={(value: any) => [`₱${value.toLocaleString()}`, '']}
                  />
                  <Legend />
                  <Bar dataKey="currentMonthSales" fill="#10B981" name="Current Month" />
                  <Bar dataKey="previousMonthSales" fill="#94a3b8" name="Previous Month" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Status Performance Tab */}
        {activeTab === 'status' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Sales by Customer Status</h2>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByStatus}
                      dataKey="currentMonthSales"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label
                    >
                      {salesByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `₱${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Details</h2>
              <div className="space-y-3">
                {salesByStatus.map((status) => (
                  <div key={status.status} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{status.status}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{status.customerCount} customers</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800 dark:text-slate-200">₱{status.currentMonthSales.toLocaleString()}</p>
                      <p className={`text-sm ${status.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {status.percentageChange >= 0 ? '+' : ''}{status.percentageChange.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Payment Type Tab */}
        {activeTab === 'payment' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Sales by Payment Type</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByPayment}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" opacity={0.1} />
                  <XAxis dataKey="paymentType" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#f8fafc' }}
                    formatter={(value: any) => [`₱${value.toLocaleString()}`, '']}
                  />
                  <Legend />
                  <Bar dataKey="currentMonthSales" fill="#8B5CF6" name="Current Month" />
                  <Bar dataKey="previousMonthSales" fill="#94a3b8" name="Previous Month" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* Inactive Customers */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Inactive Customers (30+ days)</h2>
              </div>
              {inactiveCustomers.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400">No inactive customers found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Company</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">City</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Salesman</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Last Purchase</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inactiveCustomers.map((customer) => (
                        <tr
                          key={customer.id}
                          className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                          onDoubleClick={() => setSelectedContact(customer)}
                        >
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">{customer.company}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{customer.city}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{customer.salesman}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {customer.customer_metrics?.[0]?.last_purchase_date || 'Unknown'}
                          </td>
                          <td className="text-right py-3 px-4 text-red-600 dark:text-red-400 font-medium">
                            ₱{(customer.customer_metrics?.[0]?.outstanding_balance || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Critical Inactive Customers */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Critical: Inactive with Outstanding Balance</h2>
              </div>
              {inactiveCritical.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400">No critical inactive customers found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Company</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">City</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Salesman</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Days Inactive</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inactiveCritical.map((customer) => {
                        const lastPurchase = customer.customer_metrics?.[0]?.last_purchase_date;
                        const daysInactive = lastPurchase
                          ? Math.floor((Date.now() - new Date(lastPurchase).getTime()) / (1000 * 60 * 60 * 24))
                          : 0;
                        return (
                          <tr
                            key={customer.id}
                            className="border-b border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                            onDoubleClick={() => setSelectedContact(customer)}
                          >
                            <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">{customer.company}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{customer.city}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{customer.salesman}</td>
                            <td className="py-3 px-4 text-red-600 dark:text-red-400 font-medium">{daysInactive}+ days</td>
                            <td className="text-right py-3 px-4 text-red-600 dark:text-red-400 font-bold">
                              ₱{(customer.customer_metrics?.[0]?.outstanding_balance || 0).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Inquiry Only Customers */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Inquiry-Only Customers (High Ratio)</h2>
              </div>
              {inquiryOnlyCustomers.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400">No inquiry-only customers found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Company</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">City</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Salesman</th>
                        <th className="text-center py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Inquiries</th>
                        <th className="text-center py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Purchases</th>
                        <th className="text-center py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inquiryOnlyCustomers.map((customer) => (
                        <tr
                          key={customer.id}
                          className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                          onDoubleClick={() => setSelectedContact(customer)}
                        >
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">{customer.company}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{customer.city}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{customer.salesman}</td>
                          <td className="text-center py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">{customer.totalInquiries}</td>
                          <td className="text-center py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">{customer.totalPurchases}</td>
                          <td className="text-center py-3 px-4 text-orange-600 dark:text-orange-400 font-bold">{customer.inquiryToPurchaseRatio}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagementView;
