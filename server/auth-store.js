// PostgreSQL-backed accounts and sessions. Never store plaintext passwords or session tokens.
export async function openPgAuth(connectionString) {
 const {Pool}=await import('pg');
 const pool=new Pool({connectionString,max:5,connectionTimeoutMillis:7000});
 const normalize=row=>row?{id:row.id,username:row.username,salt:row.salt,hash:row.password_hash,createdAt:new Date(row.created_at).getTime()}:null;
 try {await pool.query('SELECT id FROM auth_accounts LIMIT 0');await pool.query('SELECT token_hash FROM auth_sessions LIMIT 0');}
 catch(error){await pool.end();throw new Error('Cần chạy npm run db:migrate để tạo bảng auth_accounts/auth_sessions: '+error.message);}
 return {
  async registerAccount({id,username,salt,hash}) {
   const {rows}=await pool.query('INSERT INTO auth_accounts(id,username,salt,password_hash) VALUES($1,$2,$3,$4) RETURNING *',[id,username,salt,hash]);
   return normalize(rows[0]);
  },
  async getAccountByUsername(username) {
   const {rows}=await pool.query('SELECT * FROM auth_accounts WHERE lower(username)=lower($1) LIMIT 1',[username]);
   return normalize(rows[0]);
  },
  async createSession(tokenHash,userId,expiresAt) {
   await pool.query('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[tokenHash,userId,new Date(expiresAt)]);
  },
  async getSessionUser(tokenHash) {
   const {rows}=await pool.query('SELECT a.* FROM auth_sessions s JOIN auth_accounts a ON a.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() LIMIT 1',[tokenHash]);
   return normalize(rows[0]);
  },
  async deleteSession(tokenHash) {await pool.query('DELETE FROM auth_sessions WHERE token_hash=$1',[tokenHash]);},
  async close(){await pool.end();}
 };
}
