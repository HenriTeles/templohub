import { createClient } from '@supabase/supabase-js'
const pub = createClient(process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:false}})
const r = await pub.auth.signInWithPassword({ email:'teste.senha.audit@templohub.test', password:'NovaSenha#2026x' })
console.log('login nova senha:', r.data?.user?.id ?? 'FALHOU', r.error?.message??'')
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})
const { data } = await s.from('admin_password_resets').select('*').order('created_at',{ascending:false}).limit(5)
console.log('admin_password_resets:', JSON.stringify(data))
