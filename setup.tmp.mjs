import { createClient } from '@supabase/supabase-js'
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
const s = createClient(url, key, { auth: { persistSession:false } })
const { data: roles } = await s.from('user_roles').select('user_id').eq('role','super_admin')
const { data: profs } = await s.from('profiles').select('id,email').in('id', roles.map(r=>r.user_id))
console.log('superadmins', profs)
const email = 'teste.senha.audit@templohub.test'
const { data: list } = await s.auth.admin.listUsers({ page:1, perPage:200 })
const existing = list.users.find(u=>u.email===email)
if (existing) await s.auth.admin.deleteUser(existing.id)
const { data: created, error } = await s.auth.admin.createUser({ email, password:'SenhaAntiga#123', email_confirm:true })
console.log('created', created?.user?.id, error?.message)
