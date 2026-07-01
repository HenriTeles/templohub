// Untyped Supabase client for tables not yet reflected in generated types.
// The generated types (src/integrations/supabase/types.ts) may lag behind schema
// changes applied through our edge-function migrator; use this alias when
// interacting with those tables so TypeScript doesn't reject the calls.
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as unknown as any;
export { supabase };
