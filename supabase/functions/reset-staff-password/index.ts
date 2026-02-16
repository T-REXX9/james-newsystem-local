import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ResetPasswordPayload = {
  userId?: string;
  newPassword?: string;
};

const jsonHeaders = { 'Content-Type': 'application/json' };

const buildResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return buildResponse(405, { success: false, error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return buildResponse(500, { success: false, error: 'Missing Supabase environment variables' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return buildResponse(401, { success: false, error: 'Missing bearer token' });
  }

  const jwt = authHeader.slice('Bearer '.length);
  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const {
    data: { user: caller },
    error: callerError,
  } = await serviceClient.auth.getUser(jwt);

  if (callerError || !caller) {
    return buildResponse(401, { success: false, error: 'Unauthorized' });
  }

  const { data: callerProfile, error: profileError } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle();

  if (profileError || !callerProfile) {
    return buildResponse(403, { success: false, error: 'Unable to verify permissions' });
  }

  if (!['Owner', 'Developer'].includes(callerProfile.role)) {
    return buildResponse(403, { success: false, error: 'Insufficient permissions' });
  }

  let payload: ResetPasswordPayload;
  try {
    payload = (await req.json()) as ResetPasswordPayload;
  } catch {
    return buildResponse(400, { success: false, error: 'Invalid JSON payload' });
  }

  const userId = payload.userId?.trim();
  const newPassword = payload.newPassword?.trim();
  if (!userId || !newPassword) {
    return buildResponse(400, { success: false, error: 'userId and newPassword are required' });
  }

  if (newPassword.length < 8) {
    return buildResponse(400, { success: false, error: 'Password must be at least 8 characters' });
  }

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    return buildResponse(400, { success: false, error: updateError.message });
  }

  return buildResponse(200, { success: true });
});
