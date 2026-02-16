// Seed call monitoring demo data into Supabase using the service role key.
// Usage (requires Node 18+):
//   SUPABASE_URL=https://your-project.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=service-role-key \
//   node scripts/seedCallMonitoring.mjs

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const agent = 'James Quek';
const now = new Date();

const contacts = [
  {
    id: 'contact-demo-001',
    company: 'Autoworks Manila',
    pastName: null,
    customerSince: '2023-05-12',
    team: 'Metro',
    salesman: agent,
    referBy: 'Referral',
    address: '123 Pioneer St',
    province: 'Metro Manila',
    city: 'Mandaluyong',
    area: 'Ortigas',
    deliveryAddress: '123 Pioneer St, Mandaluyong',
    tin: '123-456-789',
    priceGroup: 'A',
    businessLine: 'Auto Parts',
    terms: '30 days',
    transactionType: 'Credit',
    vatType: 'VATable',
    vatPercentage: '12',
    dealershipTerms: 'Standard',
    dealershipSince: '2023-05-12',
    dealershipQuota: 500000,
    creditLimit: 200000,
    status: 'Active',
    isHidden: false,
    debtType: 'Good',
    comment: 'Prefers weekday morning calls.',
    contactPersons: [],
    name: 'Joey Santos',
    title: 'Procurement Lead',
    email: 'joey@autoworks.ph',
    phone: '+63 2 555 1000',
    mobile: '+63 917 111 0001',
    avatar: '',
    dealValue: 150000,
    stage: 'Qualified',
    lastContactDate: new Date(now.getTime() - 86400000).toISOString(),
    interactions: [],
    comments: [],
    salesHistory: [],
    topProducts: ['Oil Filters', 'Brake Pads'],
    assignedAgent: agent,
    aiScore: 72,
    aiReasoning: 'Recent positive feedback on delivery times.',
    winProbability: 0.64,
    nextBestAction: 'Send price sheet for Q1',
    officeAddress: '123 Pioneer St',
    shippingAddress: '123 Pioneer St',
    totalSales: 420000,
    balance: 0,
    salesByYear: { '2024': 420000 },
    price_aa: 0,
    price_bb: 0,
    price_cc: 0,
    price_dd: 0,
    price_vip1: 0,
    price_vip2: 0,
    stock_wh1: 0,
    stock_wh2: 0,
    stock_wh3: 0,
    stock_wh4: 0,
    stock_wh5: 0,
    stock_wh6: 0
  },
  {
    id: 'contact-demo-002',
    company: 'Cebu 4x4 Outfitters',
    pastName: null,
    customerSince: '2022-11-03',
    team: 'Visayas',
    salesman: agent,
    referBy: 'Inbound',
    address: 'Gov. M. Cuenco Ave',
    province: 'Cebu',
    city: 'Cebu City',
    area: 'Banilad',
    deliveryAddress: 'Gov. M. Cuenco Ave, Cebu City',
    tin: '234-567-890',
    priceGroup: 'B',
    businessLine: 'Off-road Accessories',
    terms: '15 days',
    transactionType: 'Cash',
    vatType: 'VATable',
    vatPercentage: '12',
    dealershipTerms: 'Priority',
    dealershipSince: '2022-11-03',
    dealershipQuota: 350000,
    creditLimit: 100000,
    status: 'Active',
    isHidden: false,
    debtType: 'Good',
    comment: 'Requests monthly stock report.',
    contactPersons: [],
    name: 'Lara Uy',
    title: 'Owner',
    email: 'lara@cebu4x4.ph',
    phone: '+63 32 234 9000',
    mobile: '+63 917 222 0002',
    avatar: '',
    dealValue: 90000,
    stage: 'Proposal',
    lastContactDate: new Date(now.getTime() - 2 * 86400000).toISOString(),
    interactions: [],
    comments: [],
    salesHistory: [],
    topProducts: ['Shocks', 'Tires'],
    assignedAgent: agent,
    aiScore: 69,
    aiReasoning: 'Repeat buyer; awaiting quote approval.',
    winProbability: 0.58,
    nextBestAction: 'Follow up on quote sent yesterday',
    officeAddress: 'Gov. M. Cuenco Ave',
    shippingAddress: 'Gov. M. Cuenco Ave',
    totalSales: 285000,
    balance: 0,
    salesByYear: { '2024': 285000 },
    price_aa: 0,
    price_bb: 0,
    price_cc: 0,
    price_dd: 0,
    price_vip1: 0,
    price_vip2: 0,
    stock_wh1: 0,
    stock_wh2: 0,
    stock_wh3: 0,
    stock_wh4: 0,
    stock_wh5: 0,
    stock_wh6: 0
  }
];

const callLogs = [
  {
    id: 'call-demo-001',
    contact_id: 'contact-demo-001',
    agent_name: agent,
    channel: 'call',
    direction: 'outbound',
    duration_seconds: 420,
    notes: 'Discussed reorder for oil filters.',
    outcome: 'follow_up',
    occurred_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    next_action: 'Send updated price sheet',
    next_action_due: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'call-demo-002',
    contact_id: 'contact-demo-002',
    agent_name: agent,
    channel: 'text',
    direction: 'inbound',
    duration_seconds: 0,
    notes: 'Client asked about ETA on shocks.',
    outcome: 'positive',
    occurred_at: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
    next_action: 'Confirm shipment schedule',
    next_action_due: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'call-demo-003',
    contact_id: 'contact-demo-001',
    agent_name: agent,
    channel: 'call',
    direction: 'outbound',
    duration_seconds: 180,
    notes: 'Left voicemail about delivery window.',
    outcome: 'other',
    occurred_at: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
    next_action: null,
    next_action_due: null
  }
];

const inquiries = [
  {
    id: 'inq-demo-001',
    contact_id: 'contact-demo-001',
    title: 'Need updated MSDS',
    channel: 'email',
    sentiment: 'neutral',
    occurred_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    notes: 'Client requested updated MSDS for brake pads.'
  }
];

const purchases = [
  {
    id: 'purchase-demo-001',
    contact_id: 'contact-demo-002',
    amount: 185000,
    status: 'pending',
    purchased_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Awaiting payment confirmation.'
  }
];

const teamMessages = [
  {
    id: 'msg-demo-001',
    sender_id: 'owner-001',
    sender_name: 'James Quek',
    sender_avatar: '',
    message: 'Please prioritize Autoworks Manila reorder today.',
    created_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    is_from_owner: true
  }
];

async function upsert(table, rows) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  console.log(`✔ Upserted ${rows.length} row(s) into ${table}`);
}

async function run() {
  try {
    console.log('Seeding call monitoring demo data...');

    await upsert('contacts', contacts);
    await upsert('call_logs', callLogs);
    await upsert('inquiries', inquiries);
    await upsert('purchases', purchases);
    await upsert('team_messages', teamMessages);

    console.log('\nDone. Open the Daily Call Monitoring page to see the seeded data.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

run();
