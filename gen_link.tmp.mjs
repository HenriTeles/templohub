import { createClient } from '@supabase/supabase-js'
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} })
const { data, error } = await s.auth.admin.generateLink({ type:'magiclink', email:'henriquetelesdorosario@hotmail.com' })
if (error) { console.error(error.message); process.exit(1) }
const { data: sess, error: e2 } = await s.auth.verifyOtp({ type:'magiclink', token_hash: data.properties.hashed_token })
if (e2) { console.error(e2.message); process.exit(1) }
import fs from 'fs'
fs.writeFileSync('/tmp/browser/session.json', JSON.stringify(sess.session))
console.log('session ok', !!sess.session.access_token)
