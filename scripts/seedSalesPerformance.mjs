import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Sample agent profiles with quotas
const AGENT_PROFILES = [
  { email: 'john.smith@sales.com', full_name: 'John Smith', monthly_quota: 100000, avatar_url: 'https://i.pravatar.cc/150?u=john.smith' },
  { email: 'sarah.johnson@sales.com', full_name: 'Sarah Johnson', monthly_quota: 120000, avatar_url: 'https://i.pravatar.cc/150?u=sarah.johnson' },
  { email: 'michael.chen@sales.com', full_name: 'Michael Chen', monthly_quota: 95000, avatar_url: 'https://i.pravatar.cc/150?u=michael.chen' },
  { email: 'maria.garcia@sales.com', full_name: 'Maria Garcia', monthly_quota: 110000, avatar_url: 'https://i.pravatar.cc/150?u=maria.garcia' },
  { email: 'david.wilson@sales.com', full_name: 'David Wilson', monthly_quota: 105000, avatar_url: 'https://i.pravatar.cc/150?u=david.wilson' },
];

const CUSTOMER_STATUSES = ['Active', 'Inactive', 'Prospective'];

// Generate random sales amount between 500 and 15000
const generateSalesAmount = () => {
  return Math.floor(Math.random() * 14500) + 500;
};

// Generate random customer status
const getRandomStatus = () => {
  return CUSTOMER_STATUSES[Math.floor(Math.random() * CUSTOMER_STATUSES.length)];
};

// Generate random number between min and max
const randomBetween = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Create or get agent profile
const ensureAgentProfile = async (email, fullName, monthlyQuota, avatarUrl) => {
  try {
    // Check if profile exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    // Create new profile
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        email,
        full_name: fullName,
        monthly_quota: monthlyQuota,
        avatar_url: avatarUrl,
        role: 'Sales Agent',
        access_rights: ['sales-dashboard', 'customer-database']
      })
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return data?.id;
  } catch (err) {
    console.error(`Error ensuring agent profile for ${email}:`, err);
    return null;
  }
};

// Fetch existing contacts or create sample ones
const getOrCreateContacts = async (count = 20) => {
  try {
    // Try to fetch existing contacts
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('id, company, salesman')
      .limit(count);

    if (existingContacts && existingContacts.length > 0) {
      return existingContacts;
    }

    // Create sample contacts if none exist
    const sampleContacts = Array.from({ length: count }, (_, i) => ({
      company: `Company ${i + 1}`,
      salesman: '',
      customerSince: new Date().toISOString().split('T')[0],
      team: 'Sales',
      status: getRandomStatus(),
      address: `Address ${i + 1}`,
      province: 'Metro Manila',
      city: 'Manila',
      area: 'Central',
      deliveryAddress: `Delivery Address ${i + 1}`,
      tin: `TIN${String(i + 1).padStart(5, '0')}`,
      priceGroup: 'AA',
      businessLine: 'Automotive',
      terms: 'COD',
      transactionType: 'Retail',
      vatType: 'Exclusive',
      vatPercentage: '12',
      dealershipTerms: 'Standard',
      dealershipSince: new Date().toISOString().split('T')[0],
      dealershipQuota: 50000,
      creditLimit: 100000,
      isHidden: false,
      debtType: 'Good',
      comment: '',
      contactPersons: [],
      name: `Contact ${i + 1}`,
      title: 'Manager',
      email: `contact${i + 1}@example.com`,
      phone: `555-${String(i + 1).padStart(4, '0')}`,
      avatar: `https://i.pravatar.cc/150?u=contact${i + 1}`,
      dealValue: 0,
      stage: 'New',
      interactions: [],
      comments: [],
      salesHistory: [],
      topProducts: []
    }));

    const { data: created } = await supabase
      .from('contacts')
      .insert(sampleContacts)
      .select('id, company, salesman');

    return created || [];
  } catch (err) {
    console.error('Error getting/creating contacts:', err);
    return [];
  }
};

// Generate purchases for an agent on a specific date
const generatePurchasesForDate = async (agentId, agentName, date, contacts) => {
  const purchaseCount = randomBetween(3, 8);
  const purchases = [];

  for (let i = 0; i < purchaseCount; i++) {
    const contact = contacts[Math.floor(Math.random() * contacts.length)];
    if (!contact) continue;

    purchases.push({
      contact_id: contact.id,
      amount: generateSalesAmount(),
      status: 'paid',
      purchased_at: `${date}T${String(randomBetween(8, 17)).padStart(2, '0')}:${String(randomBetween(0, 59)).padStart(2, '0')}:00`,
      notes: `Sale on ${date}`
    });

    // Update contact with agent as salesman
    await supabase
      .from('contacts')
      .update({ salesman: agentName })
      .eq('id', contact.id);
  }

  if (purchases.length > 0) {
    const { error } = await supabase
      .from('purchases')
      .insert(purchases);
    if (error) console.error('Error inserting purchases:', error);
  }

  return purchases;
};

// Calculate daily metrics for an agent
const calculateDailyMetrics = async (agentId, agentName, date, contacts) => {
  try {
    // Fetch purchases for the agent on this date
    const { data: purchases } = await supabase
      .from('purchases')
      .select('amount, contact_id')
      .gte('purchased_at', `${date}T00:00:00`)
      .lt('purchased_at', `${date}T23:59:59`);

    if (!purchases || purchases.length === 0) return;

    const totalSales = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
    const salesCount = purchases.length;

    // Insert agent_sales_summary
    const { error: summaryError } = await supabase
      .from('agent_sales_summary')
      .upsert({
        agent_id: agentId,
        date,
        total_sales: totalSales,
        sales_count: salesCount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'agent_id,date' });

    if (summaryError) console.error('Error upserting agent_sales_summary:', summaryError);

    // Fetch contacts and calculate customer breakdown
    const { data: agentContacts } = await supabase
      .from('contacts')
      .select('status')
      .eq('salesman', agentName);

    const breakdown = {
      prospective_count: agentContacts?.filter(c => c.status === 'Prospective').length || 0,
      active_count: agentContacts?.filter(c => c.status === 'Active').length || 0,
      inactive_count: agentContacts?.filter(c => c.status === 'Inactive').length || 0
    };

    const { error: breakdownError } = await supabase
      .from('agent_customer_breakdown')
      .upsert({
        agent_id: agentId,
        date,
        ...breakdown,
        updated_at: new Date().toISOString()
      }, { onConflict: 'agent_id,date' });

    if (breakdownError) console.error('Error upserting agent_customer_breakdown:', breakdownError);

    // Calculate top customers
    const { data: topCustomersData } = await supabase
      .from('purchases')
      .select('contact_id, amount, purchased_at')
      .eq('contacts.salesman', agentName)
      .order('amount', { ascending: false })
      .limit(5);

    if (topCustomersData && topCustomersData.length > 0) {
      const topCustomers = topCustomersData.map((tc, idx) => ({
        agent_id: agentId,
        contact_id: tc.contact_id,
        total_sales: tc.amount,
        last_purchase_date: tc.purchased_at?.split('T')[0],
        rank: idx + 1
      }));

      const { error: topCustomersError } = await supabase
        .from('agent_top_customers')
        .upsert(topCustomers, { onConflict: 'agent_id,contact_id' });

      if (topCustomersError) console.error('Error upserting agent_top_customers:', topCustomersError);
    }
  } catch (err) {
    console.error(`Error calculating metrics for ${agentName} on ${date}:`, err);
  }
};

// Main seed function
const seedSalesData = async () => {
  try {
    console.log('🌱 Starting Sales Performance seed...');

    // Step 1: Ensure all agent profiles exist
    console.log('📋 Setting up agent profiles...');
    const agentIds = new Map();

    for (const agent of AGENT_PROFILES) {
      const id = await ensureAgentProfile(
        agent.email,
        agent.full_name,
        agent.monthly_quota,
        agent.avatar_url
      );
      if (id) {
        agentIds.set(agent.full_name, id);
        console.log(`✅ Agent ${agent.full_name} (${id})`);
      }
    }

    // Step 2: Get or create contacts
    console.log('📌 Preparing contacts...');
    const contacts = await getOrCreateContacts(30);
    console.log(`✅ Using ${contacts.length} contacts`);

    // Step 3: Generate 30 days of historical data
    console.log('📅 Generating 30 days of sales data...');
    const today = new Date();

    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const date = new Date(today);
      date.setDate(date.getDate() - dayOffset);
      const dateString = date.toISOString().split('T')[0];

      for (const agent of AGENT_PROFILES) {
        const agentId = agentIds.get(agent.full_name);
        if (!agentId) continue;

        // Generate purchases for this agent on this date
        const purchases = await generatePurchasesForDate(
          agentId,
          agent.full_name,
          dateString,
          contacts
        );

        // Calculate metrics
        if (purchases.length > 0) {
          await calculateDailyMetrics(agentId, agent.full_name, dateString, contacts);
        }
      }

      console.log(`✅ ${dateString} - Seeded for ${AGENT_PROFILES.length} agents`);
    }

    console.log('🎉 Sales Performance seed completed successfully!');
    console.log(`📊 Generated data for:`);
    console.log(`   - ${AGENT_PROFILES.length} agents`);
    console.log(`   - 30 days of sales data`);
    console.log(`   - ${contacts.length} contacts`);
  } catch (err) {
    console.error('❌ Error during seed:', err);
    process.exit(1);
  }
};

// Run the seed
seedSalesData().then(() => {
  console.log('✨ Seed script finished');
  process.exit(0);
}).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
